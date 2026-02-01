# agcmd - Agent Command Center CLI

## Goal

An npm CLI that routes messages to AI agents running in tmux panes, with `!` escaping, injected instructions, and audit logging.

## Installation

```bash
npm install -g agcmd
```

Creates `~/.agcmd/` on first run.

## Configuration

`~/.agcmd/config.json`:
```json
{
  "agents": {
    "claude": {
      "title": "claude",
      "command": "claude"
    },
    "codex": {
      "title": "codex",
      "command": "codex"
    },
    "gemini": {
      "title": "gemini",
      "command": "gemini"
    }
  },
  "human": {
    "title": "human"
  },
  "defaultReviewFormat": "JSON with agrees, confidence, feedback (strengths/concerns/suggestions), blocking"
}
```

- **agents** - Map of agent name → config (title for pane, command to start)
- **human** - Human pane config (no command, just title)
- **defaultReviewFormat** - Template for review output format

## Agent Discovery

Panes are created by `agcmd start` with correct titles. Commands like `send`, `plan`, `review` discover agents by matching pane titles to config:

```bash
tmux list-panes -a -F "#{pane_id} #{pane_title}"
```

If agent not found: error with hint to run `agcmd start` first.

## CLI Shape

```
agcmd <agent> <verb> [args...]
```

Agent-first feels natural: "agcmd claude send" = "send to claude"

**`all` is a broadcast target, NOT an agent.** It sends to all agents defined in config:
```bash
agcmd all send "sync up"           # Broadcast to all agents
agcmd all plan feature-1 "Design"  # All agents create plans
agcmd all review feature-1         # All agents review plans
```

Behavior: iterate over `config.agents`, skip missing panes with warning (don't fail entirely).

---

## v1 Commands

### start
Set up tmux panes in **current window** and start all agents. Creates a 2x2 grid layout.

```bash
agcmd start
```

**Prerequisites:** User opens a fresh tmux window, then runs `agcmd start` there.

**Behavior:**
1. Query `tmux list-panes` to check existing panes and their titles
2. If panes with agent names (from config) already exist:
   - Warn: "Found existing panes: claude, codex. Reuse and create missing? [y/N]"
   - If yes: reuse existing agent panes, only create panes that don't exist
   - If no: abort
3. If other non-agent panes exist:
   - Warn: "Found N existing panes without agent titles. Continue? [y/N]"
4. Create 2x2 grid layout (only missing panes):
   ```
   ┌─────────┬─────────┐
   │ claude  │ codex   │
   ├─────────┼─────────┤
   │ gemini  │ human   │
   └─────────┴─────────┘
   ```
5. Query `tmux list-panes` again to get actual pane IDs after creation
6. Assign agents to panes deterministically by position (top-left, top-right, bottom-left, bottom-right)
7. Set pane titles and start agent commands (skip already-running agents)
8. Human pane left at shell prompt for running `agcmd` commands

### send
Send a message to an agent (with `!` escaping).

```bash
agcmd claude send "review the auth module"
agcmd all send "sync up on feature-1"
```

### plan
Instruct agent to create a plan. CLI injects save path.

```bash
agcmd claude plan feature-1 "Auth flow for mobile"
```

agcmd creates `~/.agcmd/plans/feature-1/` and tells the agent to save there.

Agent receives:
```
Plan the feature:

Auth flow for mobile

Save your plan to: ~/.agcmd/plans/feature-1/claude.md
```

### review
Ask agent to review plans or code. Auto-detects target type.

```bash
agcmd claude review feature-1                    # Reviews plans in ~/.agcmd/plans/feature-1/
agcmd claude review feature-1 "focus on security"  # With extra instructions
agcmd claude review main..feature-branch --type code  # Review code diff
```

Agent receives (for plan review):
```
Review the plans in ~/.agcmd/plans/feature-1/

focus on security
```

---

## v2 Commands (Agent-to-Agent)

### ask
Agent asks another agent a question. Requires human approval.

```bash
agcmd ask codex auth-design "How should we handle token refresh?"
``` 

Writes to `~/.agcmd/questions/auth-design/claude.md`, then on approval sends to codex with prefix:
```
[from: claude] How should we handle token refresh?

Save your answer to: ~/.agcmd/questions/auth-design/codex.md
Reply using: agcmd answer claude auth-design "your response"
```

### answer
Agent answers a question from another agent. **All parameters are explicit** (no inference from context).

```bash
agcmd answer <to-agent> <topic> "<message>"
agcmd answer claude auth-design "Use refresh tokens with 7-day expiry..."
```

- `<to-agent>` - Who asked the question (required)
- `<topic>` - The topic/thread being answered (required)
- `<message>` - The answer content (required)

Writes to `~/.agcmd/questions/auth-design/codex.md`, notifies claude:
```
[from: codex] Use refresh tokens with 7-day expiry...
```

---

## Filesystem Layout

```
~/.agcmd/
├── plans/
│   └── feature-1/
│       ├── claude.md
│       ├── codex.md
│       └── gemini.md
├── questions/
│   └── auth-design/
│       ├── claude.md
│       └── codex.md
└── logs/
    └── commands.jsonl
```

## Logging

All commands logged to `~/.agcmd/logs/commands.jsonl`:

```json
{"ts":"2025-02-01T10:00:00Z","agent":"claude","verb":"send","args":["review auth"],"from":"human"}
{"ts":"2025-02-01T10:01:00Z","agent":"codex","verb":"ask","args":["auth-design","how to handle tokens"],"from":"claude"}
```

## Safety

- **`!` escaping** - Auto-escape for Gemini compatibility
- **`--raw`** - Skip escaping if needed
- **Pane title required** - Clear error if not configured
- **Agent-to-agent approval** - Uses existing agent runtime approval prompts
- **`[from: <agent>]` prefix** - Only for agent-to-agent messages

## Package Structure

```
agcmd/
├── package.json
├── bin/
│   └── agcmd.js           # CLI entry (#!/usr/bin/env node)
├── lib/
│   ├── tmux.js            # Pane discovery & send-keys
│   ├── escape.js          # ! escaping
│   ├── slugify.js         # Sanitize feature/topic names for folders
│   ├── commands/
│   │   ├── send.js
│   │   ├── plan.js
│   │   ├── review.js
│   │   ├── ask.js         # v2
│   │   └── answer.js      # v2
│   └── logger.js          # JSONL logging
└── README.md
```

## Implementation Details

### tmux Send (IMPORTANT)

Must send message and Enter **separately**:

```javascript
function sendToAgent(paneId, message) {
  const escaped = escapeForAgents(message);
  // Send message, then Enter separately
  execSync(`tmux send-keys -t ${paneId} '${escaped}' && tmux send-keys -t ${paneId} Enter`);
}
```

**Wrong** (doesn't work):
```javascript
execSync(`tmux send-keys -t ${paneId} '${escaped}' Enter`);  // Enter gets absorbed
```

### Escaping

```javascript
function escapeForAgents(message) {
  return message.replace(/!/g, '\\!');
}
```

### Slugify

```javascript
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}
```

### Message Templates

**plan**:
```
<prompt>

Save your plan to: ~/.agcmd/plans/<feature>/<agent>.md
```

**review** (plan):
```
Review the plans in ~/.agcmd/plans/<feature>/

<instructions or default format from config>

Respond in format: <defaultReviewFormat>
```

### start Command Implementation

```javascript
function start() {
  // 1. Query existing panes with titles
  const existingPanes = execSync('tmux list-panes -F "#{pane_id} #{pane_title}"')
    .toString().trim().split('\n')
    .map(line => {
      const [id, ...titleParts] = line.split(' ');
      return { id, title: titleParts.join(' ') };
    });

  const agentNames = Object.keys(config.agents).concat(['human']);
  const existingAgents = existingPanes.filter(p => agentNames.includes(p.title));
  const missingAgents = agentNames.filter(name => !existingAgents.find(p => p.title === name));

  // 2. Handle existing panes
  if (existingAgents.length > 0) {
    const answer = prompt(`Found existing panes: ${existingAgents.map(p => p.title).join(', ')}. Reuse and create missing? [y/N] `);
    if (answer.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }
  }

  // 3. Create only missing panes (2x2 grid layout)
  // ... split logic for missing panes only ...

  // 4. Query panes again to get actual IDs
  const allPanes = execSync('tmux list-panes -F "#{pane_id} #{pane_title}"')
    .toString().trim().split('\n');

  // 5. Set titles and start agents (skip existing)
  missingAgents.forEach((name) => {
    const agentConfig = config.agents[name] || config.human;
    // Find pane by position, set title, start command if not human
    execSync(`tmux select-pane -T "${agentConfig.title}"`);
    if (agentConfig.command) {
      execSync(`tmux send-keys '${agentConfig.command}' && tmux send-keys Enter`);
    }
  });
}
```

### Error Handling

- **tmux not running**: "Error: tmux not available. Start a tmux session first."
- **Agent not found**: "Error: Agent 'xyz' not found. Available: claude, codex, gemini. Check pane titles with: tmux list-panes -a -F '#{pane_title}'"
- **Invalid feature name**: Auto-slugify, warn user if changed

## Implementation Priority

**v1 (MVP)**
1. `start` command - create 2x2 grid, set titles, launch agents
2. tmux pane discovery by title
3. `!` escaping
4. `send` command
5. `plan` command with injected path
6. `review` command with auto-detect
7. JSONL logging

**v2**
1. `ask` command
2. `answer` command
3. `[from: agent]` prefix for agent-to-agent

## Testing

- Unit tests for `escape.js` (! handling)
- Unit tests for `slugify.js`
- Unit tests for `detectReviewTarget()` (plan folder vs branch)
- Integration test for tmux pane discovery (mocked output)
