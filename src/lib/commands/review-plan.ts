import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, getConfigDir } from '../config.js';
import { sendKeys, getCurrentPaneId, isInTmux } from '../tmux.js';
import { getPaneId, loadPaneMapping } from '../panes.js';
import { log } from '../logger.js';
import { slugify } from '../slugify.js';
import { red, yellow, cyan } from '../ansi.js';

export interface ReviewPlanOptions {
  raw?: boolean;
  from?: string;
}

/**
 * Ask an agent to review plans for a feature.
 */
export function reviewPlan(
  target: string,
  feature: string,
  instructions?: string,
  options: ReviewPlanOptions = {}
): void {
  if (!isInTmux()) {
    console.error(red('Error: Not in a tmux session.'));
    console.error('Start a tmux session first: tmux');
    process.exit(1);
  }

  const config = loadConfig();
  const { raw = false, from = 'human' } = options;

  // Slugify the feature name
  const { slug } = slugify(feature);
  if (!slug) {
    console.error(red('Error: Feature name resulted in empty slug.'));
    console.error('Please provide a valid feature name with alphanumeric characters.');
    process.exit(1);
  }

  // Verify the plans directory exists
  const plansDir = join(getConfigDir(), 'plans', slug);
  if (!existsSync(plansDir)) {
    console.error(red(`Error: Plans directory not found: ~/.agcmd/plans/${slug}/`));
    console.error('Create plans first with: agcmd <agent> plan <feature> "<prompt>"');
    process.exit(1);
  }

  if (target === 'all') {
    reviewPlanAll(slug, instructions, config, raw, from);
  } else {
    reviewPlanOne(target, slug, instructions, config, raw, from);
  }
}

function reviewPlanOne(
  target: string,
  feature: string,
  instructions: string | undefined,
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
  const plansPath = `~/.agcmd/plans/${feature}/`;
  const message = instructions
    ? `Review the plans in ${plansPath}\n\n${instructions}\n\nRespond in format: ${config.defaultReviewFormat}`
    : `Review the plans in ${plansPath}\n\nRespond in format: ${config.defaultReviewFormat}`;

  // Send the message
  sendKeys(paneId, message, raw);

  // Log the command
  log({
    agent: target,
    verb: 'review-plan',
    args: [feature, ...(instructions ? [instructions] : [])],
    from
  });

  console.log(cyan(`Review request sent to ${target}`));
}

function reviewPlanAll(
  feature: string,
  instructions: string | undefined,
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
    const plansPath = `~/.agcmd/plans/${feature}/`;
    const message = instructions
      ? `Review the plans in ${plansPath}\n\n${instructions}\n\nRespond in format: ${config.defaultReviewFormat}`
      : `Review the plans in ${plansPath}\n\nRespond in format: ${config.defaultReviewFormat}`;

    // Send the message
    sendKeys(paneId, message, raw);

    // Log the command
    log({
      agent: agentName,
      verb: 'review-plan',
      args: [feature, ...(instructions ? [instructions] : [])],
      from
    });

    sentCount++;
  }

  console.log(cyan(`Review request broadcast to ${sentCount} agent(s)`));
}
