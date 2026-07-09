import { cn } from "@/lib/cn";

/**
 * SevynDay mark — a rounded "7" motif inside an enterprise navy badge.
 * Kept as inline SVG so it inherits currentColor and needs no asset pipeline.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
      className={cn("text-navy-800", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-navy-800" />
      <path
        d="M10 10.5h12l-6.2 12"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
