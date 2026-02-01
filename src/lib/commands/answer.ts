import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, getConfigDir } from '../config.js';
import { sendKeys, getCurrentPaneId, isInTmux } from '../tmux.js';
import { getPaneId, getAgentByPaneId } from '../panes.js';
import { log } from '../logger.js';
import { slugify } from '../slugify.js';
import { red, yellow, cyan } from '../ansi.js';

export interface AnswerOptions {
  raw?: boolean;
}

/**
 * Answer a question from another agent.
 * Detects the answering agent from the current pane.
 * Writes answer to ~/.agcmd/questions/<topic>/<from-agent>.md
 * Sends to target agent with [from: <agent>] prefix.
 */
export function answer(
  toAgent: string,
  topic: string,
  message: string,
  options: AnswerOptions = {}
): void {
  if (!isInTmux()) {
    console.error(red('Error: Not in a tmux session.'));
    console.error('Start a tmux session first: tmux');
    process.exit(1);
  }

  const config = loadConfig();
  const { raw = false } = options;

  // Detect which agent is answering (from current pane)
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
    console.error(red('Error: Answer cannot be empty.'));
    process.exit(1);
  }

  // Validate target agent exists
  if (toAgent === 'all') {
    console.error(red('Error: Cannot answer to "all".'));
    console.error('Specify the agent who asked the question.');
    process.exit(1);
  }

  if (toAgent === 'human') {
    console.error(red('Error: Cannot answer to human pane.'));
    console.error('Use "agcmd send" to communicate with humans.');
    process.exit(1);
  }

  // Check if toAgent is a valid agent (could be the one who asked)
  // Note: The asking agent might be any agent including ones we don't know
  // But we should at least check it's not completely invalid
  const agentConfig = config.agents[toAgent];
  if (!agentConfig) {
    console.error(red(`Error: Unknown agent '${toAgent}'.`));
    console.error(`Available agents: ${Object.keys(config.agents).filter(a => a !== 'human').join(', ')}`);
    process.exit(1);
  }

  // Cannot answer yourself
  if (toAgent === fromAgent) {
    console.error(red('Error: Cannot answer yourself.'));
    console.error('Specify the agent who asked the question.');
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

  // Check if the questions directory exists (optional - warn if no prior question)
  const questionsDir = join(getConfigDir(), 'questions', slug);
  if (!existsSync(questionsDir)) {
    console.log(yellow(`Warning: No prior questions found for topic '${slug}'.`));
    console.log(yellow('Creating new topic directory.'));
    mkdirSync(questionsDir, { recursive: true });
  }

  // Write the answer to file
  const answerFile = join(questionsDir, `${fromAgent}.md`);
  const timestamp = new Date().toISOString();
  const answerContent = `# Answer from ${fromAgent}\n\nTimestamp: ${timestamp}\nTo: ${toAgent}\nTopic: ${slug}\n\n---\n\n${message}\n`;
  writeFileSync(answerFile, answerContent);

  // Build the message to send (just the answer with prefix)
  const fullMessage = `[from: ${fromAgent}] ${message}`;

  // Send the message
  sendKeys(targetPaneId, fullMessage, raw);

  // Log the command
  log({
    agent: toAgent,
    verb: 'answer',
    args: [slug, message],
    from: fromAgent
  });

  console.log(cyan(`Answer sent from ${fromAgent} to ${toAgent}`));
  console.log(`Topic: ${slug}`);
  console.log(`Answer saved to: ${answerFile}`);
}
