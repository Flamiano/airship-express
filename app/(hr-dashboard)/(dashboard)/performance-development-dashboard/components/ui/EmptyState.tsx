export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-muted dark:border-paper/15">
      {message}
    </div>
  );
}