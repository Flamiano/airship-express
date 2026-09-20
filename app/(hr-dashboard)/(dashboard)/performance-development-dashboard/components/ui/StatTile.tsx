import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function StatTile({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-paper/70 sm:text-[11.5px]">
        {label}
      </p>
      <p className="mt-1.5 font-bricolage text-[22px] font-medium tracking-tight sm:text-[26px]">
        {value}
      </p>
      {href ? (
        <span
          className="mt-2 flex items-center justify-end self-end"
          aria-hidden="true"
        >
          <ArrowRight size={14} strokeWidth={1.75} className="text-paper/70 group-hover:text-paper" />
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`${tone} group flex cursor-pointer flex-col rounded-2xl px-4 py-5 text-paper transition-all duration-200 hover:opacity-90 hover:scale-[1.015] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-5`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`${tone} flex flex-col rounded-2xl px-4 py-5 text-paper sm:px-5`}>
      {content}
    </div>
  );
}