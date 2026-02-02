import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const originalHomedir = process.env.HOME;

/**
 * Helper to create a config file with logging enabled/disabled.
 */
function createConfig(testDir: string, logEnabled: boolean): void {
  const configDir = join(testDir, '.agcmd');
  mkdirSync(configDir, { recursive: true });
  const config = {
    agents: { claude: { command: 'claude' } },
    defaultReviewFormat: 'JSON',
    log: logEnabled
  };
  writeFileSync(join(configDir, 'config.json'), JSON.stringify(config));
}

describe('logger', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `agcmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    process.env.HOME = testDir;
  });

  afterEach(() => {
    process.env.HOME = originalHomedir;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('log', () => {
    it('should create log file if missing', async () => {
      createConfig(testDir, true);
      const { log, getLogPath } = await import('../../src/lib/logger.js');

      log({ agent: 'claude', verb: 'send', args: ['hello'], from: 'human' });

      const logPath = getLogPath();
      assert.ok(existsSync(logPath), 'log file should be created');
    });

    it('should append entries with newline', async () => {
      createConfig(testDir, true);
      const { log, getLogPath } = await import('../../src/lib/logger.js');

      log({ agent: 'claude', verb: 'send', args: ['hello'], from: 'human' });
      log({ agent: 'codex', verb: 'plan', args: ['feature-1', 'design'], from: 'human' });

      const content = readFileSync(getLogPath(), 'utf-8');
      const lines = content.trim().split('\n');
      assert.strictEqual(lines.length, 2, 'should have 2 lines');
    });

    it('should write valid JSON per line', async () => {
      createConfig(testDir, true);
      const { log, getLogPath } = await import('../../src/lib/logger.js');

      log({ agent: 'claude', verb: 'send', args: ['test message'], from: 'human' });

      const content = readFileSync(getLogPath(), 'utf-8');
      const lines = content.trim().split('\n');
      const entry = JSON.parse(lines[0]);

      assert.strictEqual(entry.agent, 'claude');
      assert.strictEqual(entry.verb, 'send');
      assert.deepStrictEqual(entry.args, ['test message']);
      assert.strictEqual(entry.from, 'human');
    });

    it('should include ISO 8601 timestamp', async () => {
      createConfig(testDir, true);
      const { log, getLogPath } = await import('../../src/lib/logger.js');

      const before = new Date().toISOString();
      log({ agent: 'claude', verb: 'send', args: ['hello'], from: 'human' });
      const after = new Date().toISOString();

      const content = readFileSync(getLogPath(), 'utf-8');
      const entry = JSON.parse(content.trim());

      // Verify timestamp is a valid ISO string
      assert.ok(entry.ts, 'should have timestamp');
      assert.ok(!isNaN(Date.parse(entry.ts)), 'timestamp should be valid date');
      assert.ok(entry.ts >= before && entry.ts <= after, 'timestamp should be within range');
    });

    it('should handle multiple args', async () => {
      createConfig(testDir, true);
      const { log, getLogPath } = await import('../../src/lib/logger.js');

      log({ agent: 'claude', verb: 'plan', args: ['feature-1', 'design auth'], from: 'human' });

      const content = readFileSync(getLogPath(), 'utf-8');
      const entry = JSON.parse(content.trim());

      assert.deepStrictEqual(entry.args, ['feature-1', 'design auth']);
    });

    it('should not write to log file when config.log is false', async () => {
      createConfig(testDir, false);
      const { log, getLogPath } = await import('../../src/lib/logger.js');

      log({ agent: 'claude', verb: 'send', args: ['hello'], from: 'human' });

      const logPath = getLogPath();
      assert.ok(!existsSync(logPath), 'log file should not be created when logging is disabled');
    });
  });
});
