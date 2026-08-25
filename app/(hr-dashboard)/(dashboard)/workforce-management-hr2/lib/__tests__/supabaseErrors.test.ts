import { describe, expect, it } from 'vitest';
import { isMissingTableError } from '@/lib/supabaseErrors';

describe('isMissingTableError', () => {
  it('detects the PGRST205 code', () => {
    expect(isMissingTableError({ code: 'PGRST205', message: 'Could not find the table' })).toBe(
      true
    );
  });

  it('detects the PostgREST message', () => {
    expect(
      isMissingTableError({
        code: '42P01',
        message: "Could not find the table 'public.performance_metrics' in the schema cache",
      })
    ).toBe(true);
  });

  it('returns false for other database errors', () => {
    expect(isMissingTableError({ code: '42501', message: 'permission denied for table' })).toBe(
      false
    );
    expect(isMissingTableError({ code: 'PGRST116', message: 'The result contains 0 rows' })).toBe(
      false
    );
  });

  it('returns false for null / undefined errors', () => {
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
  });
});
