import { loadConfig } from '../config.js';
import { sendKeys, getCurrentPaneId, isInTmux } from '../tmux.js';
import { getPaneId, loadPaneMapping } from '../panes.js';
import { log } from '../logger.js';
import { red, yellow, cyan } from '../ansi.js';

export interface SendOptions {
  raw?: boolean;
  from?: string;
}

/**
 * Send a message to an agent or all agents.
 */
export function send(target: string, message: string, options: SendOptions = {}): void {
  if (!isInTmux()) {
    console.error(red('Error: Not in a tmux session.'));
    console.error('Start a tmux session first: tmux');
    process.exit(1);
  }

  const config = loadConfig();
  const { raw = false, from = 'human' } = options;

  if (target === 'all') {
    // Broadcast to all agents
    sendToAll(message, config, raw, from);
  } else {
    // Send to single agent
    sendToOne(target, message, config, raw, from);
  }
}

function sendToOne(
  target: string,
  message: string,
  config: ReturnType<typeof loadConfig>,
  raw: boolean,
  from: string
): void {
  // Check if target is a known agent
  const agentConfig = config.agents[target];
  if (!agentConfig) {
    console.error(red(`Error: Unknown agent '${target}'.`));
    console.error(`Available agents: ${Object.keys(config.agents).join(', ')}`);
    process.exit(1);
  }

  // Find the pane by stored ID
  const paneId = getPaneId(target);
  if (!paneId) {
    console.error(red(`Error: Pane for agent '${target}' not found.`));
    console.error('Run "agcmd start" first to create agent panes.');
    process.exit(1);
  }

  // Send the message
  sendKeys(paneId, message, raw);

  // Log the command
  log({
    agent: target,
    verb: 'send',
    args: [message],
    from
  });

  console.log(cyan(`Sent to ${target}`));
}

function sendToAll(
  message: string,
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

    // Send the message
    sendKeys(paneId, message, raw);

    // Log the command
    log({
      agent: agentName,
      verb: 'send',
      args: [message],
      from
    });

    sentCount++;
  }

  console.log(cyan(`Broadcast to ${sentCount} agent(s)`));
}
