import { describe, it } from 'node:test';
import assert from 'node:assert';
import { red, green, yellow, cyan, bold, dim, reset } from '../../src/lib/ansi.js';

describe('ansi', () => {
  describe('red', () => {
    it('should wrap text with red ANSI codes', () => {
      const result = red('error');
      assert.strictEqual(result, '\x1b[31merror\x1b[0m');
    });

    it('should handle empty strings', () => {
      const result = red('');
      assert.strictEqual(result, '\x1b[31m\x1b[0m');
    });

    it('should handle strings with existing ANSI codes', () => {
      const result = red('\x1b[1mbold\x1b[0m');
      assert.strictEqual(result, '\x1b[31m\x1b[1mbold\x1b[0m\x1b[0m');
    });
  });

  describe('green', () => {
    it('should wrap text with green ANSI codes', () => {
      const result = green('success');
      assert.strictEqual(result, '\x1b[32msuccess\x1b[0m');
    });

    it('should handle empty strings', () => {
      const result = green('');
      assert.strictEqual(result, '\x1b[32m\x1b[0m');
    });
  });

  describe('yellow', () => {
    it('should wrap text with yellow ANSI codes', () => {
      const result = yellow('warning');
      assert.strictEqual(result, '\x1b[33mwarning\x1b[0m');
    });

    it('should handle empty strings', () => {
      const result = yellow('');
      assert.strictEqual(result, '\x1b[33m\x1b[0m');
    });
  });

  describe('cyan', () => {
    it('should wrap text with cyan ANSI codes', () => {
      const result = cyan('info');
      assert.strictEqual(result, '\x1b[36minfo\x1b[0m');
    });

    it('should handle empty strings', () => {
      const result = cyan('');
      assert.strictEqual(result, '\x1b[36m\x1b[0m');
    });
  });

  describe('bold', () => {
    it('should wrap text with bold ANSI codes', () => {
      const result = bold('important');
      assert.strictEqual(result, '\x1b[1mimportant\x1b[0m');
    });

    it('should handle empty strings', () => {
      const result = bold('');
      assert.strictEqual(result, '\x1b[1m\x1b[0m');
    });
  });

  describe('dim', () => {
    it('should wrap text with dim ANSI codes', () => {
      const result = dim('subtle');
      assert.strictEqual(result, '\x1b[2msubtle\x1b[0m');
    });

    it('should handle empty strings', () => {
      const result = dim('');
      assert.strictEqual(result, '\x1b[2m\x1b[0m');
    });
  });

  describe('reset', () => {
    it('should be the reset ANSI code', () => {
      assert.strictEqual(reset, '\x1b[0m');
    });
  });
});
