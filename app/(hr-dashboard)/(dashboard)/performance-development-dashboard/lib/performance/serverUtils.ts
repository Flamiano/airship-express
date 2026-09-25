import "server-only";
import type { PostgrestBuilder } from "@supabase/postgrest-js";

/**
 * Repeatedly retrieves rows from a Supabase query in stable, deterministic
 * pages until all matching rows have been loaded.
 *
 * The caller MUST provide a query builder with a stable `.order()` chain
 * already applied (e.g. `.order("created_at", { ascending: true }).order("id", { ascending: true })`).
 * The helper does **not** add ordering — it relies on the caller's ordering
 * to guarantee deterministic pagination.
 *
 * Pages are fetched via `.range()`.  Each page is strictly non-overlapping
 * and the union of all pages equals the full result set in the caller's
 * declared order.
 *
 * @param builder  A Supabase query builder (the return value of `.select(…)`)
 *                 that has **not** yet been awaited.
 * @param pageSize Maximum rows per page (default 1 000).  Must be > 0.
 * @returns        All rows matching the query, in the declared order.
 * @throws         Any Supabase / PostgREST error is propagated immediately.
 */
export async function selectAll<Row>(
  builder: PostgrestBuilder<any, Row[]>,
  pageSize = 1_000,
): Promise<Row[]> {
  if (pageSize <= 0) {
    throw new Error("selectAll: pageSize must be greater than 0");
  }

  const all: Row[] = [];
  let offset = 0;

  // Safety: stop after 100 000 pages to avoid accidental infinite loops.
  const maxPages = 100_000;
  let pages = 0;

  while (pages < maxPages) {
    // Clone the builder so each page is an independent request.
    // `.range()` lives on PostgrestTransformBuilder; the concrete runtime
    // object is always a PostgrestFilterBuilder which inherits it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- range() not on PostgrestBuilder base type
    const page = await (builder as any).range(offset, offset + pageSize - 1);

    const { data, error } = page as { data: Row[] | null; error: unknown };

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    all.push(...rows);

    // If we received fewer rows than the page size we have reached the end.
    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
    pages += 1;
  }

  return all;
}

/**
 * Splits an array of IDs into fixed-size chunks and runs an async callback
 * for each chunk, collecting the results.
 *
 * Useful for breaking large `.in(column, ids)` filters into manageable
 * batches so a single PostgREST request does not exceed URL-length or
 * query-parameter limits.
 *
 * @param ids       The full array of identifier values.
 * @param chunkSize Maximum number of IDs per batch (must be > 0).
 * @param run       Async callback invoked once per chunk.  Receives the
 *                  chunk of IDs and should return the result for that batch.
 * @returns         A flat array of all results, in the same order as `ids`
 *                  (concatenated chunk results).
 * @throws          Any error thrown by `run` is propagated immediately.
 */
export async function chunkedIn<T, R>(
  ids: readonly T[],
  chunkSize: number,
  run: (chunk: T[]) => Promise<R>,
): Promise<R[]> {
  if (ids.length === 0) {
    return [];
  }
  if (chunkSize <= 0) {
    throw new Error("chunkedIn: chunkSize must be greater than 0");
  }

  const results: R[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    results.push(await run(ids.slice(i, i + chunkSize)));
  }
  return results;
}
