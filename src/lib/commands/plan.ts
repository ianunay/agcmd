import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, getConfigDir } from '../config.js';
import { sendKeys, getCurrentPaneId, isInTmux } from '../tmux.js';
import { getPaneId, loadPaneMapping } from '../panes.js';
import { log } from '../logger.js';
import { slugify } from '../slugify.js';
import { red, yellow, cyan } from '../ansi.js';

export interface PlanOptions {
  raw?: boolean;
  from?: string;
}

/**
 * Instruct an agent to create a plan for a feature.
 */
export function plan(
  target: string,
  feature: string,
  prompt: string,
  options: PlanOptions = {}
): void {
  if (!isInTmux()) {
    console.error(red('Error: Not in a tmux session.'));
    console.error('Start a tmux session first: tmux');
    process.exit(1);
  }

  const config = loadConfig();
  const { raw = false, from = 'human' } = options;

  // Slugify the feature name
  const { slug, wasModified } = slugify(feature);
  if (!slug) {
    console.error(red('Error: Feature name resulted in empty slug.'));
    console.error('Please provide a valid feature name with alphanumeric characters.');
    process.exit(1);
  }
  if (wasModified) {
    console.log(yellow(`Feature name modified: '${feature}' → '${slug}'`));
  }

  // Create the plans directory
  const plansDir = join(getConfigDir(), 'plans', slug);
  if (!existsSync(plansDir)) {
    mkdirSync(plansDir, { recursive: true });
  }

  if (target === 'all') {
    // Send to all agents
    planAll(slug, prompt, config, raw, from);
  } else {
    // Send to single agent
    planOne(target, slug, prompt, config, raw, from);
  }
}

function planOne(
  target: string,
  feature: string,
  prompt: string,
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
  const savePath = `~/.agcmd/plans/${feature}/${target}.md`;
  const message = `Plan the feature:\n\n${prompt}\n\nSave your plan to: ${savePath}`;

  // Send the message
  sendKeys(paneId, message, raw);

  // Log the command
  log({
    agent: target,
    verb: 'plan',
    args: [feature, prompt],
    from
  });

  console.log(cyan(`Plan request sent to ${target}`));
  console.log(`Save path: ${savePath}`);
}

function planAll(
  feature: string,
  prompt: string,
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
    const savePath = `~/.agcmd/plans/${feature}/${agentName}.md`;
    const message = `Plan the feature:\n\n${prompt}\n\nSave your plan to: ${savePath}`;

    // Send the message
    sendKeys(paneId, message, raw);

    // Log the command
    log({
      agent: agentName,
      verb: 'plan',
      args: [feature, prompt],
      from
    });

    sentCount++;
  }

  console.log(cyan(`Plan request broadcast to ${sentCount} agent(s)`));
}
