#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { start } from '../lib/commands/start.js';
import { send } from '../lib/commands/send.js';
import { plan } from '../lib/commands/plan.js';
import { reviewPlan } from '../lib/commands/review-plan.js';
import { reviewDiff } from '../lib/commands/review-diff.js';
import { ask } from '../lib/commands/ask.js';
import { answer } from '../lib/commands/answer.js';
import { red, cyan, dim } from '../lib/ansi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf-8'));
const VERSION = pkg.version;

function printHelp(): void {
  console.log(`
${cyan("agcmd")} - Agent Command Center CLI

${dim("USAGE")}
  agcmd <command>
  agcmd <agent> <verb> [args...]

${dim("COMMANDS")}
  start                              Create tmux layout and start agents
  <agent> send "<message>"           Send message to agent
  <agent> plan <feature> "<prompt>"  Create a plan for a feature
  <agent> review-plan <feature> [instructions]
                                     Review plans for a feature
  <agent> review-diff <git-diff-args...>
                                     Review a git diff
  ask <to-agent> <topic> "<question>"
                                     Ask another agent a question
  answer <to-agent> <topic> "<response>"
                                     Answer a question from another agent

${dim("TARGETS")}
  claude, codex, gemini              Individual agents
  all                                Broadcast to all agents

${dim("OPTIONS")}
  --raw                              Skip message escaping
  --help, -h                         Show this help
  --version, -v                      Show version

${dim("EXAMPLES")}
  agcmd start
  agcmd claude send "review the auth module"
  agcmd all send "sync up"
  agcmd claude plan feature-1 "Auth flow for mobile"
  agcmd claude review-plan feature-1
  agcmd claude review-plan feature-1 "focus on security"
  agcmd claude review-diff main..HEAD
  agcmd claude review-diff --staged

${dim("AGENT-TO-AGENT EXAMPLES")}
  agcmd ask codex auth-design "How should we handle token refresh?"
  agcmd answer claude auth-design "Use refresh tokens with 7-day expiry"
`);
}

function printVersion(): void {
  console.log(`agcmd ${VERSION}`);
}

const GLOBAL_FLAGS = new Set(['raw', 'help', 'h', 'version', 'v']);

function parseArgs(args: string[]): { flags: Set<string>; positional: string[] } {
  const flags = new Set<string>();
  const positional: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--') && GLOBAL_FLAGS.has(arg.slice(2))) {
      flags.add(arg.slice(2));
    } else if (arg.startsWith('-') && arg.length === 2 && GLOBAL_FLAGS.has(arg.slice(1))) {
      flags.add(arg.slice(1));
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { flags, positional } = parseArgs(args);

  // Handle global flags
  if (flags.has('help') || flags.has('h')) {
    printHelp();
    process.exit(0);
  }

  if (flags.has('version') || flags.has('v')) {
    printVersion();
    process.exit(0);
  }

  // Check for command
  if (positional.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = positional[0];
  const raw = flags.has('raw');

  try {
    // Handle start command
    if (command === 'start') {
      await start();
      return;
    }

    // Handle ask command (agent-to-agent)
    if (command === 'ask') {
      if (positional.length < 4) {
        console.error(red('Error: Missing parameters.'));
        console.error('Usage: agcmd ask <to-agent> <topic> "<question>"');
        process.exit(1);
      }
      const toAgent = positional[1];
      const topic = positional[2];
      const question = positional[3];
      ask(toAgent, topic, question, { raw });
      return;
    }

    // Handle answer command (agent-to-agent)
    if (command === 'answer') {
      if (positional.length < 4) {
        console.error(red('Error: Missing parameters.'));
        console.error('Usage: agcmd answer <to-agent> <topic> "<response>"');
        process.exit(1);
      }
      const toAgent = positional[1];
      const topic = positional[2];
      const response = positional[3];
      answer(toAgent, topic, response, { raw });
      return;
    }

    // All other commands require: <agent> <verb> [args...]
    if (positional.length < 2) {
      console.error(red('Error: Missing verb.'));
      console.error('Usage: agcmd <agent> <verb> [args...]');
      process.exit(1);
    }

    const target = positional[0];
    const verb = positional[1];

    switch (verb) {
      case 'send': {
        if (positional.length < 3) {
          console.error(red('Error: Missing message.'));
          console.error('Usage: agcmd <agent> send "<message>"');
          process.exit(1);
        }
        const message = positional[2];
        send(target, message, { raw });
        break;
      }

      case 'plan': {
        if (positional.length < 4) {
          console.error(red('Error: Missing feature name or prompt.'));
          console.error('Usage: agcmd <agent> plan <feature> "<prompt>"');
          process.exit(1);
        }
        const feature = positional[2];
        const prompt = positional[3];
        plan(target, feature, prompt, { raw });
        break;
      }

      case 'review-plan': {
        if (positional.length < 3) {
          console.error(red('Error: Missing feature name.'));
          console.error('Usage: agcmd <agent> review-plan <feature> [instructions]');
          process.exit(1);
        }
        const feature = positional[2];
        const instructions = positional[3];
        reviewPlan(target, feature, instructions, { raw });
        break;
      }

      case 'review-diff': {
        if (positional.length < 3) {
          console.error(red('Error: Missing git diff arguments.'));
          console.error('Usage: agcmd <agent> review-diff <git-diff-args...>');
          process.exit(1);
        }
        const diffArgs = positional.slice(2);
        reviewDiff(target, diffArgs, { raw });
        break;
      }

      default:
        console.error(red(`Error: Unknown verb '${verb}'.`));
        console.error('Available verbs: send, plan, review-plan, review-diff');
        process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(red(`Error: ${message}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(red(`Fatal error: ${error.message}`));
  process.exit(1);
});
