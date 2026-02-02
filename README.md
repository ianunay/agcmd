# agcmd

Agent Command Center CLI for routing messages between AI agents running in tmux panes. Includes injected instructions for repeated tasks.

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

agcmd claude send "review the auth module"
agcmd all send "sync up"
```

## Agent-to-agent
An agent can ask another agent a question, and the other agent can respond.

```bash
agcmd ask codex auth-design "How should we handle token refresh?"
agcmd answer claude auth-design "Use refresh tokens with 7-day expiry"
```

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

## Files

```
~/.agcmd/
  plans/<feature>/<agent>.md
  questions/<topic>/<agent>.md
  logs/commands.jsonl
```

## Commands

- `agcmd start`
- `agcmd <agent> send "..."`
- `agcmd <agent> plan <feature> "..."`
- `agcmd <agent> review <feature | diff> [--type code]`
- `agcmd ask <to-agent> <topic> "..."`
- `agcmd answer <to-agent> <topic> "..."`
