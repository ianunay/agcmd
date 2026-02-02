export interface AgentConfig {
  command: string;
}

export interface Config {
  agents: Record<string, AgentConfig>;
  defaultReviewFormat: string;
  log: boolean;
}

export interface Pane {
  id: string;
}

export interface LogEntry {
  ts: string;
  agent: string;
  verb: string;
  args: string[];
  from: string;
}
