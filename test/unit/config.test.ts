import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setExecFn, resetExecFn } from '../../src/lib/exec.js';

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
    resetExecFn();
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
    it('should create the config directory', async () => {
      const { ensureConfigDir, getConfigDir } = await import('../../src/lib/config.js');
      ensureConfigDir();

      const configDir = getConfigDir();
      assert.ok(existsSync(configDir), 'config dir should exist');
    });

    it('should not fail if directory already exists', async () => {
      const { ensureConfigDir } = await import('../../src/lib/config.js');
      ensureConfigDir();
      assert.doesNotThrow(() => ensureConfigDir());
    });
  });

  describe('getProjectDir', () => {
    it('should return path under ~/.agcmd/projects/', async () => {
      const fakeGitRoot = join(testDir, 'my-repos', 'my-project');
      mkdirSync(fakeGitRoot, { recursive: true });

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return fakeGitRoot + '\n';
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getProjectDir } = await import('../../src/lib/config.js');
      const result = getProjectDir();

      assert.ok(result.startsWith(join(testDir, '.agcmd', 'projects')), 'should be under ~/.agcmd/projects/');
    });

    it('should contain slugified path relative to home', async () => {
      const fakeGitRoot = join(testDir, 'Code', 'my-project');
      mkdirSync(fakeGitRoot, { recursive: true });

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return fakeGitRoot + '\n';
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getProjectDir } = await import('../../src/lib/config.js');
      const result = getProjectDir();

      // relative path is "Code/my-project", slugified = "code-my-project"
      assert.ok(result.endsWith('code-my-project'), `expected path to end with slugified name, got: ${result}`);
    });

    it('should create directory if it does not exist', async () => {
      const fakeGitRoot = join(testDir, 'repos', 'new-project');
      mkdirSync(fakeGitRoot, { recursive: true });

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return fakeGitRoot + '\n';
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getProjectDir } = await import('../../src/lib/config.js');
      const result = getProjectDir();

      assert.ok(existsSync(result), 'project directory should be created');
    });

    it('should produce different directories for different git repos', async () => {
      const repoA = join(testDir, 'repos', 'project-a');
      const repoB = join(testDir, 'repos', 'project-b');
      mkdirSync(repoA, { recursive: true });
      mkdirSync(repoB, { recursive: true });

      let currentRepo = repoA;
      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return currentRepo + '\n';
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getProjectDir } = await import('../../src/lib/config.js');
      const dirA = getProjectDir();

      currentRepo = repoB;
      const dirB = getProjectDir();

      assert.notStrictEqual(dirA, dirB, 'different repos should have different project dirs');
    });

    it('should fall back to cwd when not in a git repo', async () => {
      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          throw new Error('fatal: not a git repository');
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getProjectDir } = await import('../../src/lib/config.js');
      const result = getProjectDir();

      // Should still return a valid path under ~/.agcmd/projects/
      assert.ok(result.startsWith(join(testDir, '.agcmd', 'projects')), 'should fall back to cwd-based path');
      assert.ok(existsSync(result), 'fallback directory should be created');
    });
  });

  describe('getSessionDir', () => {
    it('should return path under <projectDir>/sessions/', async () => {
      const fakeGitRoot = join(testDir, 'repos', 'my-project');
      mkdirSync(fakeGitRoot, { recursive: true });

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return fakeGitRoot + '\n';
        }
        if (cmd.includes('tmux display-message')) {
          return '@1\n';
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getSessionDir } = await import('../../src/lib/config.js');
      const result = getSessionDir();

      assert.ok(result.includes('sessions'), 'should contain sessions in path');
      assert.ok(result.includes('@1'), 'should contain window ID in path');
    });

    it('should include window ID in the path', async () => {
      const fakeGitRoot = join(testDir, 'repos', 'my-project');
      mkdirSync(fakeGitRoot, { recursive: true });

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return fakeGitRoot + '\n';
        }
        if (cmd.includes('tmux display-message')) {
          return '@42\n';
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getSessionDir } = await import('../../src/lib/config.js');
      const result = getSessionDir();

      assert.ok(result.endsWith('@42'), `expected path to end with window ID, got: ${result}`);
    });

    it('should create session directory if it does not exist', async () => {
      const fakeGitRoot = join(testDir, 'repos', 'my-project');
      mkdirSync(fakeGitRoot, { recursive: true });

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return fakeGitRoot + '\n';
        }
        if (cmd.includes('tmux display-message')) {
          return '@5\n';
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getSessionDir } = await import('../../src/lib/config.js');
      const result = getSessionDir();

      assert.ok(existsSync(result), 'session directory should be created');
    });

    it('should produce different paths for different window IDs', async () => {
      const fakeGitRoot = join(testDir, 'repos', 'my-project');
      mkdirSync(fakeGitRoot, { recursive: true });

      let windowId = '@1';
      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return fakeGitRoot + '\n';
        }
        if (cmd.includes('tmux display-message')) {
          return windowId + '\n';
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getSessionDir } = await import('../../src/lib/config.js');
      const dir1 = getSessionDir();

      windowId = '@2';
      const dir2 = getSessionDir();

      assert.notStrictEqual(dir1, dir2, 'different window IDs should produce different paths');
    });

    it('should fall back to "default" when not in tmux', async () => {
      const fakeGitRoot = join(testDir, 'repos', 'my-project');
      mkdirSync(fakeGitRoot, { recursive: true });

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return fakeGitRoot + '\n';
        }
        if (cmd.includes('tmux display-message')) {
          throw new Error('not in tmux');
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getSessionDir } = await import('../../src/lib/config.js');
      const result = getSessionDir();

      assert.ok(result.endsWith('default'), `expected path to end with "default", got: ${result}`);
    });

    it('should fall back to "default" when tmux returns empty string', async () => {
      const fakeGitRoot = join(testDir, 'repos', 'my-project');
      mkdirSync(fakeGitRoot, { recursive: true });

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return fakeGitRoot + '\n';
        }
        if (cmd.includes('tmux display-message')) {
          return '\n';
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { getSessionDir } = await import('../../src/lib/config.js');
      const result = getSessionDir();

      assert.ok(result.endsWith('default'), `expected fallback to "default" for empty window ID, got: ${result}`);
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
