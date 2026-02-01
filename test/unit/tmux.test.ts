import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';

describe('tmux', () => {
  const originalTmux = process.env.TMUX;

  afterEach(() => {
    if (originalTmux) {
      process.env.TMUX = originalTmux;
    } else {
      delete process.env.TMUX;
    }
  });

  describe('isInTmux', () => {
    it('should return true when TMUX is set', async () => {
      process.env.TMUX = '/tmp/tmux-501/default,12345,0';
      const { isInTmux } = await import('../../src/lib/tmux.js');
      assert.strictEqual(isInTmux(), true);
    });

    it('should return false when TMUX is not set', async () => {
      delete process.env.TMUX;
      const { isInTmux } = await import('../../src/lib/tmux.js');
      assert.strictEqual(isInTmux(), false);
    });

    it('should return false when TMUX is empty', async () => {
      process.env.TMUX = '';
      const { isInTmux } = await import('../../src/lib/tmux.js');
      assert.strictEqual(isInTmux(), false);
    });
  });
});
