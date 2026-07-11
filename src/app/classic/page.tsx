import { Container } from "@/components/Container";
import { Section, SectionHeading } from "@/components/Section";
import { Button } from "@/components/Button";
import { FeatureCard } from "@/components/FeatureCard";
import { CTASection } from "@/components/CTASection";
import { HeroSphere } from "@/components/HeroSphere";
import {
  ShieldIcon,
  WorkflowIcon,
  ChartIcon,
  ClipboardIcon,
  UsersIcon,
  LockIcon,
  CheckIcon,
} from "@/components/icons";

const features = [
  {
    title: "Accommodation management",
    description:
      "Track accommodation requests, functional abilities, and restrictions in one auditable record — from intake through review.",
    icon: <ClipboardIcon />,
  },
  {
    title: "Return-to-work workflows",
    description:
      "Guided, stage-based RTW plans keep employees, managers, and providers aligned and on schedule.",
    icon: <WorkflowIcon />,
  },
  {
    title: "Absence & leave tracking",
    description:
      "STD, LTD, WSIB, and statutory leaves in a single caseload view with automated eligibility and status.",
    icon: <ChartIcon />,
  },
  {
    title: "Ontario-first compliance",
    description:
      "Built around the AODA, the Human Rights Code, and ESA obligations, with the audit trail to prove it.",
    icon: <ShieldIcon />,
  },
  {
    title: "Stakeholder collaboration",
    description:
      "Give HR, managers, and third-party providers role-scoped access to exactly what each case requires.",
    icon: <UsersIcon />,
  },
  {
    title: "Enterprise-grade security",
    description:
      "SOC 2 controls, Canadian data residency, and granular permissions protect sensitive health information.",
    icon: <LockIcon />,
  },
];

const stats = [
  { value: "40%", label: "less time spent on manual case administration" },
  { value: "100%", label: "of cases with a complete, defensible audit trail" },
  { value: "3x", label: "faster return-to-work plan turnaround" },
];

const proofPoints = [
  "Purpose-built for Ontario employment and human-rights obligations",
  "Consolidates disability, leave, and absence into one caseload",
  "Deploys alongside your existing HRIS and payroll",
];

export default function HomePage() {
  return (
    <>
      {/* Hero — interactive 3D sphere (client-only) */}
      <HeroSphere />

      {/* Proof points */}
      <section className="border-b border-slate-200 bg-white">
        <Container className="pb-8">
          <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3">
            {proofPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 text-sm text-slate-600"
              >
                <CheckIcon className="mt-0.5 shrink-0 text-accent-600" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Stats band */}
      <section className="border-b border-slate-200 bg-slate-50">
        <Container className="grid gap-8 py-12 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-4xl font-semibold tracking-tight text-navy-900">
                {stat.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {stat.label}
              </p>
            </div>
          ))}
        </Container>
      </section>

      {/* Features */}
      <Section>
        <SectionHeading
          eyebrow="The platform"
          title="Everything a disability program needs, in one place"
          description="Replace fragmented spreadsheets, email threads, and point tools with a single system of record built for the complexity of Ontario workplaces."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </Section>

      {/* Compliance highlight */}
      <section className="bg-slate-50 py-16 sm:py-24">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Compliance by design"
              title="Defensible decisions, documented automatically"
              description="Every accommodation, leave, and return-to-work decision is captured with the context, timeline, and approvals you need — so an audit is a report, not a fire drill."
            />
            <div className="mt-8">
              <Button href="/compliance" variant="secondary">
                How we handle compliance
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
            <ul className="space-y-5">
              {[
                "AODA & Integrated Accessibility Standards aligned",
                "Ontario Human Rights Code duty-to-accommodate workflows",
                "Employment Standards Act (ESA) leave rules built in",
                "Immutable audit trail on every case action",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <span className="text-sm leading-relaxed text-slate-700">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <CTASection />
    </>
  );
}
