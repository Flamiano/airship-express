
export default function IconBtn({ icon: Icon, title, danger }: { icon: React.ElementType; title?: string; danger?: boolean }) {
  return (
    <button
      className={`p-1.5 rounded-md border border-line text-muted hover:text-foreground hover:cursor-pointer hover:border-muted/50 transition-colors ${
        danger ? "hover:text-red-500 hover:border-red-400 dark:hover:text-red-400" : ""
      }`}
    >
      <Icon size={14} title={title} />
    </button>
  );
}