/**
 * Strip characters that are meaningful inside a PostgREST `or=(...)` filter
 * (commas / parentheses) and the LIKE wildcards (% _), so user input can't
 * break or widen the query. Also collapses whitespace and caps length.
 */
export function sanitizeSearchQuery(q: string): string {
  return q
    .replace(/[%_,()*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
