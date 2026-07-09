import { cn } from "@/lib/cn";

type FeatureCardProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
};

export function FeatureCard({ title, description, icon, className }: FeatureCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-6 shadow-card transition-shadow hover:shadow-lg",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-navy-800/5 text-navy-800">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}
