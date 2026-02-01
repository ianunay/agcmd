import { describe, it } from 'node:test';
import assert from 'node:assert';
import { slugify } from '../../src/lib/slugify.js';

describe('slugify', () => {
  it('should not modify already valid slugs', () => {
    const result = slugify('feature-1');
    assert.strictEqual(result.slug, 'feature-1');
    assert.strictEqual(result.wasModified, false);
  });

  it('should lowercase and replace spaces', () => {
    const result = slugify('Feature 1');
    assert.strictEqual(result.slug, 'feature-1');
    assert.strictEqual(result.wasModified, true);
  });

  it('should replace underscores and special characters', () => {
    const result = slugify('my_cool_feature!!!');
    assert.strictEqual(result.slug, 'my-cool-feature');
    assert.strictEqual(result.wasModified, true);
  });

  it('should collapse consecutive hyphens', () => {
    const result = slugify('--double--dashes--');
    assert.strictEqual(result.slug, 'double-dashes');
    assert.strictEqual(result.wasModified, true);
  });

  it('should handle empty string', () => {
    const result = slugify('');
    assert.strictEqual(result.slug, '');
    assert.strictEqual(result.wasModified, false);
  });

  it('should handle string with only special characters', () => {
    const result = slugify('!!!@@@###');
    assert.strictEqual(result.slug, '');
    assert.strictEqual(result.wasModified, true);
  });

  it('should handle unicode characters', () => {
    const result = slugify('café-résumé');
    assert.strictEqual(result.slug, 'caf-r-sum');
    assert.strictEqual(result.wasModified, true);
  });

  it('should handle mixed case with numbers', () => {
    const result = slugify('Feature123Test');
    assert.strictEqual(result.slug, 'feature123test');
    assert.strictEqual(result.wasModified, true);
  });

  it('should trim leading hyphens', () => {
    const result = slugify('---leading');
    assert.strictEqual(result.slug, 'leading');
    assert.strictEqual(result.wasModified, true);
  });

  it('should trim trailing hyphens', () => {
    const result = slugify('trailing---');
    assert.strictEqual(result.slug, 'trailing');
    assert.strictEqual(result.wasModified, true);
  });

  it('should handle single character', () => {
    const result = slugify('a');
    assert.strictEqual(result.slug, 'a');
    assert.strictEqual(result.wasModified, false);
  });

  it('should handle numbers only', () => {
    const result = slugify('123');
    assert.strictEqual(result.slug, '123');
    assert.strictEqual(result.wasModified, false);
  });
});
