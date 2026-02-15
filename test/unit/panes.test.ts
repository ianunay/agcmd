import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setExecFn, resetExecFn } from '../../src/lib/exec.js';

const originalHomedir = process.env.HOME;

describe('panes', () => {
  let testDir: string;
  let fakeGitRoot: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `agcmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    process.env.HOME = testDir;

    fakeGitRoot = join(testDir, 'repos', 'my-project');
    mkdirSync(fakeGitRoot, { recursive: true });

    // Mock exec for git and tmux commands
    setExecFn((cmd: string) => {
      if (cmd.includes('git rev-parse --show-toplevel')) {
        return fakeGitRoot + '\n';
      }
      if (cmd.includes('tmux display-message')) {
        return '@1\n';
      }
      throw new Error(`Unexpected command: ${cmd}`);
    });
  });

  afterEach(() => {
    process.env.HOME = originalHomedir;
    resetExecFn();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getPanesPath', () => {
    it('should return path under session directory', async () => {
      const { getPanesPath } = await import('../../src/lib/panes.js');
      const result = getPanesPath();

      // Should be <projectDir>/sessions/@1/panes.json
      assert.ok(result.includes('sessions'), 'path should include sessions directory');
      assert.ok(result.includes('@1'), 'path should include window ID');
      assert.ok(result.endsWith('panes.json'), 'path should end with panes.json');
    });
  });

  describe('loadPaneMapping', () => {
    it('should return empty object when file does not exist', async () => {
      const { loadPaneMapping } = await import('../../src/lib/panes.js');
      const result = loadPaneMapping();
      assert.deepStrictEqual(result, {});
    });

    it('should return saved mapping', async () => {
      const { loadPaneMapping, savePaneMapping } = await import('../../src/lib/panes.js');

      const mapping = { claude: '%1', codex: '%2', gemini: '%3' };
      savePaneMapping(mapping);

      const result = loadPaneMapping();
      assert.deepStrictEqual(result, mapping);
    });
  });

  describe('getPaneId', () => {
    it('should return null when agent not found', async () => {
      const { getPaneId } = await import('../../src/lib/panes.js');
      const result = getPaneId('nonexistent');
      assert.strictEqual(result, null);
    });

    it('should return pane ID when agent exists', async () => {
      const { getPaneId, savePaneMapping } = await import('../../src/lib/panes.js');

      savePaneMapping({ claude: '%1', codex: '%2' });

      const result = getPaneId('claude');
      assert.strictEqual(result, '%1');
    });
  });

  describe('getAgentByPaneId', () => {
    it('should return null when pane not found', async () => {
      const { getAgentByPaneId } = await import('../../src/lib/panes.js');
      const result = getAgentByPaneId('%99');
      assert.strictEqual(result, null);
    });

    it('should return null when mapping is empty', async () => {
      const { getAgentByPaneId } = await import('../../src/lib/panes.js');
      const result = getAgentByPaneId('%1');
      assert.strictEqual(result, null);
    });

    it('should return agent name when pane ID exists', async () => {
      const { getAgentByPaneId, savePaneMapping } = await import('../../src/lib/panes.js');

      savePaneMapping({ claude: '%1', codex: '%2', gemini: '%3' });

      assert.strictEqual(getAgentByPaneId('%1'), 'claude');
      assert.strictEqual(getAgentByPaneId('%2'), 'codex');
      assert.strictEqual(getAgentByPaneId('%3'), 'gemini');
    });

    it('should return first match when multiple agents have same pane (edge case)', async () => {
      const { getAgentByPaneId, savePaneMapping } = await import('../../src/lib/panes.js');

      // This shouldn't happen in practice, but test the behavior
      savePaneMapping({ claude: '%1', codex: '%1' });

      const result = getAgentByPaneId('%1');
      // Should return one of them (order depends on object iteration)
      assert.ok(result === 'claude' || result === 'codex');
    });
  });

  describe('session isolation', () => {
    it('should store panes in different dirs for different sessions', async () => {
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

      const { savePaneMapping, loadPaneMapping } = await import('../../src/lib/panes.js');

      // Save mapping for session @1
      savePaneMapping({ claude: '%1', codex: '%2' });
      const mapping1 = loadPaneMapping();
      assert.deepStrictEqual(mapping1, { claude: '%1', codex: '%2' });

      // Switch to session @2
      windowId = '@2';

      // Should be empty in new session
      const mapping2 = loadPaneMapping();
      assert.deepStrictEqual(mapping2, {}, 'new session should have empty pane mapping');

      // Save different mapping for session @2
      savePaneMapping({ claude: '%3', gemini: '%4' });
      const mapping2After = loadPaneMapping();
      assert.deepStrictEqual(mapping2After, { claude: '%3', gemini: '%4' });

      // Switch back to session @1 — should still have original mapping
      windowId = '@1';
      const mapping1After = loadPaneMapping();
      assert.deepStrictEqual(mapping1After, { claude: '%1', codex: '%2' }, 'original session should retain its mapping');
    });
  });
});
