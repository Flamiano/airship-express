export function formatDate(date: string | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
  });
}

export function todayManila(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
}
