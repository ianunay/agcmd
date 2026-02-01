import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setExecFn, resetExecFn } from '../../src/lib/exec.js';

const originalHomedir = process.env.HOME;
const originalTmux = process.env.TMUX;

describe('answer command', () => {
  let testDir: string;
  let execCalls: string[];

  beforeEach(() => {
    testDir = join(tmpdir(), `agcmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    process.env.HOME = testDir;
    process.env.TMUX = '/tmp/tmux-501/default,12345,0';
    execCalls = [];

    // Mock exec - current pane is codex (%2)
    setExecFn((cmd: string) => {
      execCalls.push(cmd);
      if (cmd.includes('display-message')) {
        return '%2'; // Current pane is codex
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

  async function setupPanes() {
    const { ensureConfigDir } = await import('../../src/lib/config.js');
    const { savePaneMapping } = await import('../../src/lib/panes.js');
    ensureConfigDir();
    savePaneMapping({ claude: '%1', codex: '%2', gemini: '%3', human: '%0' });
  }

  async function setupPanesWithQuestion() {
    await setupPanes();
    // Create a prior question from claude
    const questionsDir = join(testDir, '.agcmd', 'questions', 'auth-design');
    mkdirSync(questionsDir, { recursive: true });
  }

  describe('validation', () => {
    it('should error when not in tmux', async () => {
      delete process.env.TMUX;
      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        answer('claude', 'test-topic', 'my answer');
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

      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        answer('claude', 'test-topic', 'my answer');
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

      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        answer('claude', 'test-topic', 'my answer');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when answer is empty', async () => {
      await setupPanes();
      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        answer('claude', 'test-topic', '');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when target is "all"', async () => {
      await setupPanes();
      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        answer('all', 'test-topic', 'my answer');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when target is "human"', async () => {
      await setupPanes();
      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        answer('human', 'test-topic', 'my answer');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when target agent does not exist', async () => {
      await setupPanes();
      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        answer('nonexistent', 'test-topic', 'my answer');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when answering yourself', async () => {
      await setupPanes();
      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        // Current pane is codex (%2), trying to answer codex
        answer('codex', 'test-topic', 'my answer');
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
      // Only save codex, not claude
      savePaneMapping({ codex: '%2' });

      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        answer('claude', 'test-topic', 'my answer');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });

    it('should error when topic results in empty slug', async () => {
      await setupPanes();
      const { answer } = await import('../../src/lib/commands/answer.js');

      let exitCode: number | undefined;
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;

      try {
        answer('claude', '!!!', 'my answer');
      } catch {
        // Expected
      }

      process.exit = originalExit;
      assert.strictEqual(exitCode, 1);
    });
  });

  describe('successful answer', () => {
    it('should create answer file and send message', async () => {
      await setupPanesWithQuestion();
      const { answer } = await import('../../src/lib/commands/answer.js');

      answer('claude', 'auth-design', 'Use refresh tokens with 7-day expiry');

      // Check answer file was created
      const answerFile = join(testDir, '.agcmd', 'questions', 'auth-design', 'codex.md');
      assert.ok(existsSync(answerFile), 'answer file should exist');

      const content = readFileSync(answerFile, 'utf-8');
      assert.ok(content.includes('Answer from codex'), 'should contain from agent');
      assert.ok(content.includes('To: claude'), 'should contain to agent');
      assert.ok(content.includes('Use refresh tokens with 7-day expiry'), 'should contain message');
    });

    it('should send message with [from: agent] prefix', async () => {
      await setupPanesWithQuestion();
      const { answer } = await import('../../src/lib/commands/answer.js');

      answer('claude', 'auth-design', 'Use refresh tokens');

      // Check tmux send-keys was called with correct message
      const sendKeysCall = execCalls.find(c => c.includes('send-keys') && c.includes('[from: codex]'));
      assert.ok(sendKeysCall, 'should send message with [from: codex] prefix');
      assert.ok(sendKeysCall.includes('Use refresh tokens'), 'should include the answer');
    });

    it('should warn but proceed when no prior question exists', async () => {
      await setupPanes();
      // Don't create the questions directory
      const { answer } = await import('../../src/lib/commands/answer.js');

      // Should not throw, just warn
      answer('claude', 'new-topic', 'response to something');

      // Should still create the file
      const answerFile = join(testDir, '.agcmd', 'questions', 'new-topic', 'codex.md');
      assert.ok(existsSync(answerFile), 'answer file should still be created');
    });

    it('should slugify topic name', async () => {
      await setupPanes();
      const { answer } = await import('../../src/lib/commands/answer.js');

      answer('claude', 'Auth Design v2!!!', 'my response');

      const answerDir = join(testDir, '.agcmd', 'questions', 'auth-design-v2');
      assert.ok(existsSync(answerDir), 'should create directory with slugified name');
    });

    it('should log the command', async () => {
      await setupPanesWithQuestion();
      const { answer } = await import('../../src/lib/commands/answer.js');

      answer('claude', 'auth-design', 'my response');

      const logFile = join(testDir, '.agcmd', 'logs', 'commands.jsonl');
      assert.ok(existsSync(logFile), 'log file should exist');

      const logContent = readFileSync(logFile, 'utf-8');
      const logEntry = JSON.parse(logContent.trim());
      assert.strictEqual(logEntry.agent, 'claude');
      assert.strictEqual(logEntry.verb, 'answer');
      assert.strictEqual(logEntry.from, 'codex');
    });

    it('should send to correct pane ID', async () => {
      await setupPanesWithQuestion();
      const { answer } = await import('../../src/lib/commands/answer.js');

      answer('claude', 'auth-design', 'my response');

      // Claude's pane is %1
      const sendKeysCall = execCalls.find(c => c.includes('send-keys -t %1'));
      assert.ok(sendKeysCall, 'should send to claude pane (%1)');
    });
  });
});
