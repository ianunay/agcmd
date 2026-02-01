import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const originalHomedir = process.env.HOME;

describe('panes', () => {
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

  describe('getPanesPath', () => {
    it('should return correct path', async () => {
      const { getPanesPath } = await import('../../src/lib/panes.js');
      const result = getPanesPath();
      assert.strictEqual(result, join(testDir, '.agcmd', 'panes.json'));
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
      const { ensureConfigDir } = await import('../../src/lib/config.js');

      ensureConfigDir();
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
      const { ensureConfigDir } = await import('../../src/lib/config.js');

      ensureConfigDir();
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
      const { ensureConfigDir } = await import('../../src/lib/config.js');

      ensureConfigDir();
      savePaneMapping({ claude: '%1', codex: '%2', gemini: '%3' });

      assert.strictEqual(getAgentByPaneId('%1'), 'claude');
      assert.strictEqual(getAgentByPaneId('%2'), 'codex');
      assert.strictEqual(getAgentByPaneId('%3'), 'gemini');
    });

    it('should return first match when multiple agents have same pane (edge case)', async () => {
      const { getAgentByPaneId, savePaneMapping } = await import('../../src/lib/panes.js');
      const { ensureConfigDir } = await import('../../src/lib/config.js');

      ensureConfigDir();
      // This shouldn't happen in practice, but test the behavior
      savePaneMapping({ claude: '%1', codex: '%1' });

      const result = getAgentByPaneId('%1');
      // Should return one of them (order depends on object iteration)
      assert.ok(result === 'claude' || result === 'codex');
    });
  });
});
