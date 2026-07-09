import { Container } from "@/components/Container";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-gradient-to-b from-navy-900 to-navy-800">
      <Container className="py-16 sm:py-20">
        {eyebrow ? (
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-300">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-navy-100">
            {description}
          </p>
        ) : null}
      </Container>
    </div>
  );
}
