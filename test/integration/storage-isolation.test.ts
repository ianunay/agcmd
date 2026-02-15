import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setExecFn, resetExecFn } from '../../src/lib/exec.js';

const originalHomedir = process.env.HOME;

describe('storage isolation', () => {
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

  describe('project isolation', () => {
    it('should keep data separate across different projects', async () => {
      const repoA = join(testDir, 'repos', 'project-a');
      const repoB = join(testDir, 'repos', 'project-b');
      mkdirSync(repoA, { recursive: true });
      mkdirSync(repoB, { recursive: true });

      let currentRepo = repoA;
      let windowId = '@1';

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return currentRepo + '\n';
        }
        if (cmd.includes('tmux display-message')) {
          return windowId + '\n';
        }
        return '';
      });

      const { getProjectDir, getSessionDir } = await import('../../src/lib/config.js');
      const { savePaneMapping, loadPaneMapping } = await import('../../src/lib/panes.js');

      // Save pane mapping for project A
      savePaneMapping({ claude: '%1', codex: '%2' });
      const mappingA = loadPaneMapping();
      assert.deepStrictEqual(mappingA, { claude: '%1', codex: '%2' });
      const projectDirA = getProjectDir();

      // Write a file to project A's directory
      writeFileSync(join(projectDirA, 'project-a-marker.txt'), 'project A');

      // Switch to project B
      currentRepo = repoB;
      const projectDirB = getProjectDir();

      // Project B should be completely separate
      assert.notStrictEqual(projectDirA, projectDirB, 'project dirs should differ');

      // Project B should have empty pane mapping (different session dir)
      const mappingB = loadPaneMapping();
      assert.deepStrictEqual(mappingB, {}, 'project B should have no pane mapping');

      // Project B should not have project A's marker file
      assert.ok(
        !existsSync(join(projectDirB, 'project-a-marker.txt')),
        'project B should not have project A files'
      );

      // Verify project A's data is still intact
      currentRepo = repoA;
      const mappingAAgain = loadPaneMapping();
      assert.deepStrictEqual(mappingAAgain, { claude: '%1', codex: '%2' }, 'project A mapping should still exist');
      assert.ok(
        existsSync(join(projectDirA, 'project-a-marker.txt')),
        'project A marker file should still exist'
      );
    });
  });

  describe('session isolation within a project', () => {
    it('should keep session data separate within the same project', async () => {
      const repo = join(testDir, 'repos', 'shared-project');
      mkdirSync(repo, { recursive: true });

      let windowId = '@1';

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return repo + '\n';
        }
        if (cmd.includes('tmux display-message')) {
          return windowId + '\n';
        }
        return '';
      });

      const { getProjectDir, getSessionDir } = await import('../../src/lib/config.js');
      const { savePaneMapping, loadPaneMapping } = await import('../../src/lib/panes.js');

      // Sessions should be within the same project
      const sessionDir1 = getSessionDir();
      windowId = '@2';
      const sessionDir2 = getSessionDir();

      // Both sessions should share the same project dir
      const projectDir = getProjectDir();
      assert.ok(sessionDir1.startsWith(projectDir), 'session 1 should be under project dir');
      assert.ok(sessionDir2.startsWith(projectDir), 'session 2 should be under project dir');

      // But they should be different directories
      assert.notStrictEqual(sessionDir1, sessionDir2, 'session dirs should differ');

      // Save different pane mappings for each session
      windowId = '@1';
      savePaneMapping({ claude: '%1', codex: '%2' });

      windowId = '@2';
      savePaneMapping({ claude: '%5', gemini: '%6' });

      // Verify each session has its own mapping
      windowId = '@1';
      const mapping1 = loadPaneMapping();
      assert.deepStrictEqual(mapping1, { claude: '%1', codex: '%2' });

      windowId = '@2';
      const mapping2 = loadPaneMapping();
      assert.deepStrictEqual(mapping2, { claude: '%5', gemini: '%6' });
    });
  });

  describe('global config is shared', () => {
    it('should use the same config across all projects', async () => {
      const repoA = join(testDir, 'repos', 'project-a');
      const repoB = join(testDir, 'repos', 'project-b');
      mkdirSync(repoA, { recursive: true });
      mkdirSync(repoB, { recursive: true });

      let currentRepo = repoA;

      setExecFn((cmd: string) => {
        if (cmd.includes('git rev-parse --show-toplevel')) {
          return currentRepo + '\n';
        }
        if (cmd.includes('tmux display-message')) {
          return '@1\n';
        }
        return '';
      });

      const { loadConfig, getConfigDir, ensureConfigDir } = await import('../../src/lib/config.js');

      // Create config while in project A
      ensureConfigDir();
      const customConfig = {
        agents: { myagent: { command: 'my-cli' } },
        defaultReviewFormat: 'text',
        log: true
      };
      writeFileSync(join(getConfigDir(), 'config.json'), JSON.stringify(customConfig));

      // Load config from project A
      const configA = loadConfig();
      assert.strictEqual(configA.agents.myagent?.command, 'my-cli');

      // Switch to project B — should still see same config
      currentRepo = repoB;
      const configB = loadConfig();
      assert.strictEqual(configB.agents.myagent?.command, 'my-cli');
      assert.strictEqual(configB.defaultReviewFormat, 'text');
    });
  });
});
