import { createInterface } from 'node:readline';
import { loadConfig } from '../config.js';
import {
  isInTmux,
  listPanes,
  splitPane,
  selectPane,
  runInPane,
  getCurrentPaneId
} from '../tmux.js';
import { savePaneMapping, loadPaneMapping } from '../panes.js';
import { red, yellow, green, cyan } from '../ansi.js';

/**
 * Prompt user for confirmation.
 */
async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Start command - creates tmux layout and launches agents.
 */
export async function start(): Promise<void> {
  // Check if in tmux
  if (!isInTmux()) {
    console.error(red('Error: Not in a tmux session.'));
    console.error('Start a tmux session first: tmux');
    process.exit(1);
  }

  const config = loadConfig();
  const agentNames = Object.keys(config.agents);

  // Check if we already have a pane mapping
  const existingMapping = loadPaneMapping();
  if (Object.keys(existingMapping).length > 0) {
    const confirmed = await confirm(
      yellow(`Found existing pane mapping. Overwrite? [y/N] `)
    );
    if (!confirmed) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Check existing panes in window
  const existingPanes = listPanes();
  if (existingPanes.length > 1) {
    const confirmed = await confirm(
      yellow(`Found ${existingPanes.length} existing panes. Continue and create layout? [y/N] `)
    );
    if (!confirmed) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log(cyan(`Creating panes for: ${agentNames.join(', ')}, human`));

  // Get the current pane (will be used as starting point)
  const startPaneId = getCurrentPaneId();

  // Create layout: human on left (40%), agents stacked on right (60%)
  // ┌──────────┬──────────┐
  // │          │ agent-1  │
  // │          ├──────────┤
  // │  human   │ agent-2  │
  // │          ├──────────┤
  // │          │ agent-N  │
  // └──────────┴──────────┘

  const paneIds: Record<string, string> = {};

  // Human pane is the starting pane
  paneIds['human'] = startPaneId;

  // Split horizontally to create agents area (60% on right)
  selectPane(startPaneId);
  const firstAgentPaneId = splitPane('h', 60);

  // Create panes for each agent
  let currentAgentPane = firstAgentPaneId;
  for (let i = 0; i < agentNames.length; i++) {
    const agentName = agentNames[i];

    if (i === 0) {
      // First agent uses the initial split
      paneIds[agentName] = currentAgentPane;
    } else {
      // Split vertically for remaining agents
      selectPane(currentAgentPane);
      const percent = Math.floor(100 - (100 / (agentNames.length - i + 1)));
      const newPaneId = splitPane('v', percent);
      paneIds[agentName] = newPaneId;
      currentAgentPane = newPaneId;
    }

    // Start the agent command
    const agentConfig = config.agents[agentName];
    if (agentConfig?.command) {
      runInPane(paneIds[agentName], agentConfig.command);
    }
  }

  // Save pane mapping to disk
  savePaneMapping(paneIds);

  // Select the human pane at the end
  selectPane(paneIds['human']);

  console.log(green('Agent layout created successfully.'));
  console.log('');
  console.log('Panes:');
  for (const [name, id] of Object.entries(paneIds)) {
    console.log(`  ${cyan(name)}: ${id}`);
  }
  console.log('');
  console.log(`Mapping saved to ~/.agcmd/panes.json`);
}
