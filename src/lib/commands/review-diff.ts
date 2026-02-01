import { loadConfig } from '../config.js';
import { sendKeys, getCurrentPaneId, isInTmux } from '../tmux.js';
import { getPaneId, loadPaneMapping } from '../panes.js';
import { log } from '../logger.js';
import { red, yellow, cyan } from '../ansi.js';

export interface ReviewDiffOptions {
  raw?: boolean;
  from?: string;
}

/**
 * Ask an agent to review a git diff.
 */
export function reviewDiff(
  target: string,
  diffArgs: string[],
  options: ReviewDiffOptions = {}
): void {
  if (!isInTmux()) {
    console.error(red('Error: Not in a tmux session.'));
    console.error('Start a tmux session first: tmux');
    process.exit(1);
  }

  const config = loadConfig();
  const { raw = false, from = 'human' } = options;

  if (target === 'all') {
    reviewDiffAll(diffArgs, config, raw, from);
  } else {
    reviewDiffOne(target, diffArgs, config, raw, from);
  }
}

function reviewDiffOne(
  target: string,
  diffArgs: string[],
  config: ReturnType<typeof loadConfig>,
  raw: boolean,
  from: string
): void {
  const agentConfig = config.agents[target];
  if (!agentConfig) {
    console.error(red(`Error: Unknown agent '${target}'.`));
    console.error(`Available agents: ${Object.keys(config.agents).join(', ')}`);
    process.exit(1);
  }

  const paneId = getPaneId(target);
  if (!paneId) {
    console.error(red(`Error: Pane for agent '${target}' not found.`));
    console.error('Run "agcmd start" first to create agent panes.');
    process.exit(1);
  }

  // Build the message
  const diffArgsStr = diffArgs.join(' ');
  const message = `Review the git diff: git diff ${diffArgsStr}\n\nRespond in format: ${config.defaultReviewFormat}`;

  // Send the message
  sendKeys(paneId, message, raw);

  // Log the command
  log({
    agent: target,
    verb: 'review-diff',
    args: diffArgs,
    from
  });

  console.log(cyan(`Diff review request sent to ${target}`));
}

function reviewDiffAll(
  diffArgs: string[],
  config: ReturnType<typeof loadConfig>,
  raw: boolean,
  from: string
): void {
  const agentNames = Object.keys(config.agents);
  const currentPaneId = getCurrentPaneId();
  const paneMapping = loadPaneMapping();
  let sentCount = 0;

  for (const agentName of agentNames) {
    // Skip human pane
    if (agentName === 'human') {
      continue;
    }

    const paneId = paneMapping[agentName];

    if (!paneId) {
      console.log(yellow(`Warning: Pane for '${agentName}' not found, skipping.`));
      continue;
    }

    // Skip self (the pane we're running from)
    if (paneId === currentPaneId) {
      continue;
    }

    // Build the message
    const diffArgsStr = diffArgs.join(' ');
    const message = `Review the git diff: git diff ${diffArgsStr}\n\nRespond in format: ${config.defaultReviewFormat}`;

    // Send the message
    sendKeys(paneId, message, raw);

    // Log the command
    log({
      agent: agentName,
      verb: 'review-diff',
      args: diffArgs,
      from
    });

    sentCount++;
  }

  console.log(cyan(`Diff review request broadcast to ${sentCount} agent(s)`));
}
