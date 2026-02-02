import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setExecFn, resetExecFn } from '../../src/lib/exec.js';

const originalHomedir = process.env.HOME;
const originalTmux = process.env.TMUX;

describe('ask command', () => {
  let testDir: string;
  let execCalls: string[];

  beforeEach(() => {
    testDir = join(tmpdir(), `agcmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    process.env.HOME = testDir;
    process.env.TMUX = '/tmp/tmux-501/default,12345,0';
    execCalls = [];

    // Mock exec to capture tmux commands
    setExecFn((cmd: string) => {
      execCalls.push(cmd);
      if (cmd.includes('display-message')) {
        return '%1'; // Current pane is claude
      }
      return '';
    });
  });

  afterEach(() => {
    process.env.HOME = originalHomedir;
    if (originalTmux) {
      process.env.TMUX = originalTmux;
    } else {
      delete process.env.TMUX;
    }
    resetExecFn();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  async function setupPanes(enableLogging = false) {
    const { ensureConfigDir, getConfigDir } = await import('../../src/lib/config.js');
    const { savePaneMapping } = await import('../../src/lib/panes.js');
    ensureConfigDir();
    savePaneMapping({ claude: '%1', codex: '%2', gemini: '%3', human: '%0' });

    if (enableLogging) {
      const config = {
        agents: { claude: { command: 'claude' }, codex: { command: 'codex' }, gemini: { command: 'gemini' } },
        defaultReviewFormat: 'JSON',
        log: true
      };
      writeFileSync(join(getConfigDir(), 'config.json'), JSON.stringify(config));
    }
  }

  describe('validation', () => {
    it('should error when not in tmux', async () => {
      delete process.env.TMUX;
      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('codex', 'test-topic', 'hello');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when current pane is not a known agent', async () => {
      setExecFn((cmd: string) => {
        if (cmd.includes('display-message')) {
          return '%99'; // Unknown pane
        }
        return '';
      });

      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('codex', 'test-topic', 'hello');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when running from the human pane', async () => {
      // Set up panes including human
      const { ensureConfigDir } = await import('../../src/lib/config.js');
      const { savePaneMapping } = await import('../../src/lib/panes.js');
      ensureConfigDir();
      savePaneMapping({ claude: '%1', codex: '%2', gemini: '%3', human: '%0' });

      // Current pane is human
      setExecFn((cmd: string) => {
        if (cmd.includes('display-message')) {
          return '%0'; // Human pane
        }
        return '';
      });

      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('codex', 'test-topic', 'hello');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when message is empty', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('codex', 'test-topic', '');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when message is only whitespace', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('codex', 'test-topic', '   ');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when target is "all"', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('all', 'test-topic', 'hello');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when target is "human"', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('human', 'test-topic', 'hello');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when target agent does not exist', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('nonexistent', 'test-topic', 'hello');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when asking yourself', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        // Current pane is claude (%1), trying to ask claude
        ask('claude', 'test-topic', 'hello');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when target pane not found', async () => {
      const { ensureConfigDir } = await import('../../src/lib/config.js');
      const { savePaneMapping } = await import('../../src/lib/panes.js');
      ensureConfigDir();
      // Only save claude, not codex
      savePaneMapping({ claude: '%1' });

      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('codex', 'test-topic', 'hello');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when topic results in empty slug', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        ask('codex', '!!!', 'hello');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });
  });

  describe('successful ask', () => {
    it('should create question file and send message', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      ask('codex', 'auth-design', 'How should we handle tokens?');

      // Check question file was created
      const questionFile = join(testDir, '.agcmd', 'questions', 'auth-design', 'claude.md');
      assert.ok(existsSync(questionFile), 'question file should exist');

      const content = readFileSync(questionFile, 'utf-8');
      assert.ok(content.includes('Question from claude'), 'should contain from agent');
      assert.ok(content.includes('To: codex'), 'should contain to agent');
      assert.ok(content.includes('How should we handle tokens?'), 'should contain message');
    });

    it('should send message with [from: agent] prefix', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      ask('codex', 'auth-design', 'How should we handle tokens?');

      // Check tmux send-keys was called with correct message
      const sendKeysCall = execCalls.find(c => c.includes('send-keys') && c.includes('[from: claude]'));
      assert.ok(sendKeysCall, 'should send message with [from: claude] prefix');
      assert.ok(sendKeysCall.includes('How should we handle tokens?'), 'should include the question');
      assert.ok(sendKeysCall.includes('agcmd answer claude auth-design'), 'should include reply instructions');
    });

    it('should slugify topic name', async () => {
      await setupPanes();
      const { ask } = await import('../../src/lib/commands/ask.js');

      ask('codex', 'Auth Design v2!!!', 'question');

      const questionDir = join(testDir, '.agcmd', 'questions', 'auth-design-v2');
      assert.ok(existsSync(questionDir), 'should create directory with slugified name');
    });

    it('should log the command', async () => {
      await setupPanes(true);
      const { ask } = await import('../../src/lib/commands/ask.js');

      ask('codex', 'test-topic', 'hello');

      const logFile = join(testDir, '.agcmd', 'logs', 'commands.jsonl');
      assert.ok(existsSync(logFile), 'log file should exist');

      const logContent = readFileSync(logFile, 'utf-8');
      const logEntry = JSON.parse(logContent.trim());
      assert.strictEqual(logEntry.agent, 'codex');
      assert.strictEqual(logEntry.verb, 'ask');
      assert.strictEqual(logEntry.from, 'claude');
    });
  });
});
