const cache = new Map<string, string>();

export async function loadKnowledgeClient(key: string): Promise<string> {
  if (cache.has(key)) return cache.get(key)!;

  const res = await fetch(
    `/payroll-benefits-dashboard/ai/api/knowledge?key=${key}`,
    { cache: "force-cache" }
  );

  if (!res.ok) {
    throw new Error(`Failed to load knowledge: ${key} (${res.status})`);
  }

  const { content } = await res.json();
  cache.set(key, content);
  return content;
}

export function clearClientKnowledgeCache(): void {
  cache.clear();
}
