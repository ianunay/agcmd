# agcmd

Agent Command Center CLI for routing messages between AI agents running in tmux panes. Includes injected instructions for repeated tasks.


<img width="1442" height="906" alt="Screenshot 2026-03-18 at 10 45 57" src="https://github.com/user-attachments/assets/02714699-2d82-4a94-b3ed-5996a96ba157" />


Tmux window layout:
<pre>
┌──────────┬──────────┐
│          │ agent-1  │
│          ├──────────┤
│  human   │ agent-2  │
│          ├──────────┤
│          │ agent-N  │
└──────────┴──────────┘
</pre>

## Prerequisites
- Node.js >=22 (haven't tested on earlier versions)
- tmux

## Install

```bash
npm install -g agcmd
```

## Quickstart

```bash
# inside a tmux window
agcmd start # splits the window into panes for each agent

agcmd claude send "implement the auth module"
agcmd codex send "review the auth module"
agcmd all send "sync up"
```

## Commands

- `agcmd start`
- `agcmd <agent> send "..."`
- `agcmd <agent> plan <feature> "..."`
- `agcmd <agent> review <feature | diff> [--type code]`
- `agcmd ask <to-agent> <topic> "..."`
- `agcmd answer <to-agent> <topic> "..."`

## Config

Config is stored at `~/.agcmd/config.json` (created on first run). Minimal example:

```json
{
  "agents": {
    "claude": { "command": "claude" },
    "codex": { "command": "codex" },
    "gemini": { "command": "gemini" }
  },
  "defaultReviewFormat": "JSON with agrees, confidence, blocking, review-comments",
  "log": false
}
```

## Storage Layout

Data is isolated per-project and per-tmux-window:

```
~/.agcmd/
├── config.json                          # Global (shared across all projects)
└── projects/
    └── <slugified-path>/                # Per-project (e.g., code-agcmd)
        ├── plans/
        │   └── <feature>/
        │       └── <agent>.md
        ├── questions/
        │   └── <topic>/
        │       └── <agent>.md
        ├── logs/
        │   └── commands.jsonl
        └── sessions/
            └── <tmux-window-id>/        # Per-window (e.g., @0, @3)
                └── panes.json
```

- **Project path** is derived from the git root, slugified relative to `$HOME` (e.g., `~/Code/agcmd` → `code-agcmd`). Falls back to cwd if not in a git repo.
- **Session** uses the tmux window ID so multiple windows can run independent agent sets. Falls back to `default` outside tmux.

## Agent-to-agent (coming soon)
An agent can ask another agent a question, and the other agent can respond.

```bash
agcmd ask codex auth-design "How should we handle token refresh?"
agcmd answer claude auth-design "Use refresh tokens with 7-day expiry"
```

