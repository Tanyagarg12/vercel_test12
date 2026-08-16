import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ViewAllLink({ href, label = "View All" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 text-[13px] font-medium text-[var(--series-1)] hover:underline"
    >
      {label}
      <ArrowRight size={13} />
    </Link>
  );
}
