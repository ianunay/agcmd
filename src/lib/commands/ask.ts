import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, getConfigDir } from '../config.js';
import { sendKeys, getCurrentPaneId, isInTmux } from '../tmux.js';
import { getPaneId, getAgentByPaneId } from '../panes.js';
import { log } from '../logger.js';
import { slugify } from '../slugify.js';
import { red, yellow, cyan } from '../ansi.js';

export interface AskOptions {
  raw?: boolean;
}

/**
 * Ask another agent a question.
 * Detects the asking agent from the current pane.
 * Writes question to ~/.agcmd/questions/<topic>/<from-agent>.md
 * Sends to target agent with [from: <agent>] prefix.
 */
export function ask(
  toAgent: string,
  topic: string,
  message: string,
  options: AskOptions = {}
): void {
  if (!isInTmux()) {
    console.error(red('Error: Not in a tmux session.'));
    console.error('Start a tmux session first: tmux');
    process.exit(1);
  }

  const config = loadConfig();
  const { raw = false } = options;

  // Detect which agent is asking (from current pane)
  const currentPaneId = getCurrentPaneId();
  const fromAgent = getAgentByPaneId(currentPaneId);

  // Must be running from a known agent pane (not human, not unknown)
  if (!fromAgent || !config.agents[fromAgent]) {
    console.error(red('Error: Must run from an agent pane.'));
    console.error('This command is for agent-to-agent communication.');
    console.error('Use "agcmd <agent> send" to message agents from the human pane.');
    process.exit(1);
  }

  // Validate message is not empty
  if (!message || !message.trim()) {
    console.error(red('Error: Message cannot be empty.'));
    process.exit(1);
  }

  // Validate target agent exists
  if (toAgent === 'all') {
    console.error(red('Error: Cannot ask "all" agents.'));
    console.error('Specify a single agent to ask.');
    process.exit(1);
  }

  if (toAgent === 'human') {
    console.error(red('Error: Cannot ask the human pane.'));
    console.error('Use "agcmd send" to communicate with humans.');
    process.exit(1);
  }

  const agentConfig = config.agents[toAgent];
  if (!agentConfig) {
    console.error(red(`Error: Unknown agent '${toAgent}'.`));
    console.error(`Available agents: ${Object.keys(config.agents).filter(a => a !== 'human').join(', ')}`);
    process.exit(1);
  }

  // Cannot ask yourself
  if (toAgent === fromAgent) {
    console.error(red('Error: Cannot ask yourself.'));
    console.error('Specify a different agent to ask.');
    process.exit(1);
  }

  // Find the target pane
  const targetPaneId = getPaneId(toAgent);
  if (!targetPaneId) {
    console.error(red(`Error: Pane for agent '${toAgent}' not found.`));
    console.error('Run "agcmd start" first to create agent panes.');
    process.exit(1);
  }

  // Slugify the topic name
  const { slug, wasModified } = slugify(topic);
  if (!slug) {
    console.error(red('Error: Topic name resulted in empty slug.'));
    console.error('Please provide a valid topic name with alphanumeric characters.');
    process.exit(1);
  }
  if (wasModified) {
    console.log(yellow(`Topic name modified: '${topic}' → '${slug}'`));
  }

  // Create the questions directory
  const questionsDir = join(getConfigDir(), 'questions', slug);
  if (!existsSync(questionsDir)) {
    mkdirSync(questionsDir, { recursive: true });
  }

  // Write the question to file
  const questionFile = join(questionsDir, `${fromAgent}.md`);
  const timestamp = new Date().toISOString();
  const questionContent = `# Question from ${fromAgent}\n\nTimestamp: ${timestamp}\nTo: ${toAgent}\nTopic: ${slug}\n\n---\n\n${message}\n`;
  writeFileSync(questionFile, questionContent);

  // Build the message to send
  const answerPath = `~/.agcmd/questions/${slug}/${toAgent}.md`;
  const fullMessage = `[from: ${fromAgent}] ${message}

Save your answer to: ${answerPath}
Reply using: agcmd answer ${fromAgent} ${slug} "your response"`;

  // Send the message
  sendKeys(targetPaneId, fullMessage, raw);

  // Log the command
  log({
    agent: toAgent,
    verb: 'ask',
    args: [slug, message],
    from: fromAgent
  });

  console.log(cyan(`Question sent from ${fromAgent} to ${toAgent}`));
  console.log(`Topic: ${slug}`);
  console.log(`Question saved to: ${questionFile}`);
}
