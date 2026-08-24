type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-line bg-paper p-6 transition-colors dark:border-paper/15 dark:bg-ink ${className}`}
    >
      {children}
    </div>
  );
}
