import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const originalHomedir = process.env.HOME;

describe('config', () => {
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

  describe('getConfigDir', () => {
    it('should return correct path based on HOME', async () => {
      const { getConfigDir } = await import('../../src/lib/config.js');
      const result = getConfigDir();
      assert.strictEqual(result, join(testDir, '.agcmd'));
    });
  });

  describe('ensureConfigDir', () => {
    it('should create all subdirectories', async () => {
      const { ensureConfigDir, getConfigDir } = await import('../../src/lib/config.js');
      ensureConfigDir();

      const configDir = getConfigDir();
      assert.ok(existsSync(configDir), 'config dir should exist');
      assert.ok(existsSync(join(configDir, 'plans')), 'plans dir should exist');
      assert.ok(existsSync(join(configDir, 'questions')), 'questions dir should exist');
      assert.ok(existsSync(join(configDir, 'logs')), 'logs dir should exist');
    });

    it('should not fail if directories already exist', async () => {
      const { ensureConfigDir } = await import('../../src/lib/config.js');
      ensureConfigDir();
      assert.doesNotThrow(() => ensureConfigDir());
    });
  });

  describe('getDefaultConfig', () => {
    it('should return expected default config', async () => {
      const { getDefaultConfig } = await import('../../src/lib/config.js');
      const config = getDefaultConfig();

      assert.ok(config.agents.claude, 'should have claude agent');
      assert.ok(config.agents.codex, 'should have codex agent');
      assert.ok(config.agents.gemini, 'should have gemini agent');
      assert.strictEqual(config.agents.claude.command, 'claude');
      assert.ok(config.defaultReviewFormat.length > 0, 'should have review format');
    });
  });

  describe('loadConfig', () => {
    it('should create default config when missing', async () => {
      const { loadConfig, getConfigDir } = await import('../../src/lib/config.js');
      const config = loadConfig();

      assert.ok(config.agents.claude, 'should have claude agent');

      const configPath = join(getConfigDir(), 'config.json');
      assert.ok(existsSync(configPath), 'config file should be created');
    });

    it('should read existing config', async () => {
      const { loadConfig, getConfigDir, ensureConfigDir } = await import('../../src/lib/config.js');

      ensureConfigDir();
      const customConfig = {
        agents: {
          myagent: { command: 'myagent-cli' }
        },
        defaultReviewFormat: 'custom format'
      };
      const configPath = join(getConfigDir(), 'config.json');
      writeFileSync(configPath, JSON.stringify(customConfig));

      const config = loadConfig();
      assert.strictEqual(config.agents.myagent?.command, 'myagent-cli');
      assert.strictEqual(config.defaultReviewFormat, 'custom format');
    });

    it('should throw helpful error for malformed JSON', async () => {
      const { loadConfig, getConfigDir, ensureConfigDir } = await import('../../src/lib/config.js');

      ensureConfigDir();
      const configPath = join(getConfigDir(), 'config.json');
      writeFileSync(configPath, '{ invalid json }');

      assert.throws(
        () => loadConfig(),
        /Failed to parse config\.json/
      );
    });
  });
});
