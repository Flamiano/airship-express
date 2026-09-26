/**
 * True when a Supabase/PostgREST error means the table doesn't exist yet
 * (e.g. schema.sql hasn't been applied since a table was added). Callers use
 * this to degrade gracefully instead of surfacing a 500 to the UI.
 */
export function isMissingTableError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  return (
    error?.code === 'PGRST205' ||
    error?.message?.includes('Could not find the table') === true
  );
}
