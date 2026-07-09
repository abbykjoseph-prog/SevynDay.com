import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const sizes = "px-5 py-2.5";

const variants: Record<Variant, string> = {
  primary: "bg-navy-800 text-white hover:bg-navy-700",
  secondary:
    "bg-white text-navy-800 ring-1 ring-inset ring-navy-200 hover:bg-navy-50",
  ghost: "text-navy-800 hover:bg-navy-50",
};

type ButtonProps = {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

export function Button({ href, variant = "primary", className, children }: ButtonProps) {
  return (
    <Link href={href} className={cn(base, sizes, variants[variant], className)}>
      {children}
    </Link>
  );
}
