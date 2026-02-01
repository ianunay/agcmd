# agcmd

Agent Command Center CLI for routing messages between AI agents running in tmux panes. Includes `!` escaping, injected instructions, and audit logging.

## Install

```bash
npm install -g agcmd
```

## Quickstart

```bash
# inside a tmux window
agcmd start

dagcmd claude send "review the auth module"
agcmd all send "sync up"
```

## Agent-to-agent

```bash
agcmd ask codex auth-design "How should we handle token refresh?"
agcmd answer claude auth-design "Use refresh tokens with 7-day expiry"
```

## Config

Config is stored at `~/.agcmd/config.json` (created on first run). Minimal example:

```json
{
  "agents": {
    "claude": { "title": "claude", "command": "claude" },
    "codex": { "title": "codex", "command": "codex" },
    "gemini": { "title": "gemini", "command": "gemini" }
  },
  "human": { "title": "human" }
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

## Dev

```bash
npm test
```
