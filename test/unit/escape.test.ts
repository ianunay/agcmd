import { describe, it } from 'node:test';
import assert from 'node:assert';
import { escapeForShell, escapeForAgents, escapeMessage } from '../../src/lib/escape.js';

describe('escape', () => {
  describe('escapeForShell', () => {
    it('should escape single quotes', () => {
      assert.strictEqual(escapeForShell("don't"), "don'\\''t");
    });

    it('should handle multiple single quotes', () => {
      assert.strictEqual(escapeForShell("it's a 'test'"), "it'\\''s a '\\''test'\\''");
    });

    it('should return unchanged string without single quotes', () => {
      assert.strictEqual(escapeForShell("hello world"), "hello world");
    });

    it('should handle empty string', () => {
      assert.strictEqual(escapeForShell(""), "");
    });

    it('should handle string with only single quote', () => {
      assert.strictEqual(escapeForShell("'"), "'\\''");
    });
  });

  describe('escapeForAgents', () => {
    it('should escape exclamation marks', () => {
      assert.strictEqual(escapeForAgents("hello!"), "hello\\!");
    });

    it('should handle multiple exclamation marks', () => {
      assert.strictEqual(escapeForAgents("wow!!!"), "wow\\!\\!\\!");
    });

    it('should return unchanged string without exclamation marks', () => {
      assert.strictEqual(escapeForAgents("hello world"), "hello world");
    });

    it('should handle empty string', () => {
      assert.strictEqual(escapeForAgents(""), "");
    });

    it('should handle string with only exclamation mark', () => {
      assert.strictEqual(escapeForAgents("!"), "\\!");
    });
  });

  describe('escapeMessage', () => {
    it('should combine shell and agent escaping', () => {
      assert.strictEqual(escapeMessage("don't forget!"), "don'\\''t forget\\!");
    });

    it('should handle complex strings', () => {
      assert.strictEqual(escapeMessage("it's working!!!"), "it'\\''s working\\!\\!\\!");
    });

    it('should skip escaping when raw is true', () => {
      assert.strictEqual(escapeMessage("don't forget!", true), "don't forget!");
    });

    it('should handle empty string', () => {
      assert.strictEqual(escapeMessage(""), "");
    });

    it('should handle string with backslash', () => {
      // Backslashes are left alone, only quotes and ! are escaped
      assert.strictEqual(escapeMessage("path\\to\\file"), "path\\to\\file");
    });

    it('should escape both quotes and exclamation marks together', () => {
      assert.strictEqual(escapeMessage("'!'"), "'\\''\\!'\\''");
    });
  });
});
