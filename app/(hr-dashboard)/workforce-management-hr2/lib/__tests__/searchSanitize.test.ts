import { describe, expect, it } from 'vitest';
import { sanitizeSearchQuery } from '@/lib/searchSanitize';

describe('sanitizeSearchQuery', () => {
  it('keeps normal search terms', () => {
    expect(sanitizeSearchQuery('Dana Cruz')).toBe('Dana Cruz');
  });

  it('neutralizes PostgREST filter injection characters', () => {
    expect(sanitizeSearchQuery('full_name.ilike.%admin%')).toBe('full name.ilike. admin');
    expect(sanitizeSearchQuery('name.eq.(jane)')).toBe('name.eq. jane');
    expect(sanitizeSearchQuery('a%2Cb')).toBe('a 2Cb');
  });

  it('neutralizes the LIKE wildcard underscore', () => {
    expect(sanitizeSearchQuery('a_b')).toBe('a b');
  });

  it('collapses repeated whitespace', () => {
    expect(sanitizeSearchQuery('  Dana   Cruz  ')).toBe('Dana Cruz');
  });

  it('caps input at 60 characters', () => {
    expect(sanitizeSearchQuery('x'.repeat(120))).toHaveLength(60);
  });

  it('handles empty and whitespace-only input', () => {
    expect(sanitizeSearchQuery('')).toBe('');
    expect(sanitizeSearchQuery('    ')).toBe('');
  });
});
