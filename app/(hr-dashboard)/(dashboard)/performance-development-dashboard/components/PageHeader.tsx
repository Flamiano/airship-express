type PageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
};

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      <p className="font-rethink text-[13px] font-medium uppercase tracking-[0.2em] text-accent">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-bricolage text-[30px] font-medium leading-tight tracking-tight sm:text-[36px]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 max-w-xl text-sm text-muted">{subtitle}</p>
      )}
    </div>
  );
}
