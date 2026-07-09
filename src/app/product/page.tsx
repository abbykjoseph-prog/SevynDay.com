import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Section, SectionHeading } from "@/components/Section";
import { FeatureCard } from "@/components/FeatureCard";
import { CTASection } from "@/components/CTASection";
import { ClipboardIcon, WorkflowIcon, ChartIcon, UsersIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Product",
  description:
    "The SevynDay platform: accommodation, leave, absence, and return-to-work management for Ontario employers.",
};

const modules = [
  {
    title: "Case management",
    description:
      "A single record for each employee case — intake, documentation, restrictions, and decisions in one timeline.",
    icon: <ClipboardIcon />,
  },
  {
    title: "Return-to-work planning",
    description:
      "Stage-based plans with tasks, reminders, and stakeholder sign-off to keep every RTW on track.",
    icon: <WorkflowIcon />,
  },
  {
    title: "Absence & leave",
    description:
      "STD, LTD, WSIB, and statutory leave tracking with eligibility rules and status at a glance.",
    icon: <ChartIcon />,
  },
  {
    title: "Collaboration & access",
    description:
      "Role-scoped access for HR, managers, and third-party providers, with a full activity log.",
    icon: <UsersIcon />,
  },
];

export default function ProductPage() {
  return (
    <>
      <PageHeader
        eyebrow="Product"
        title="One platform for the entire disability lifecycle"
        description="From first absence to full return, SevynDay replaces scattered spreadsheets and inboxes with a system of record your whole team can trust."
      />

      <Section>
        <SectionHeading
          title="Core modules"
          description="Deploy what you need today and expand as your program matures."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {modules.map((module) => (
            <FeatureCard key={module.title} {...module} />
          ))}
        </div>
      </Section>

      <Section className="border-t border-slate-200 bg-slate-50">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">
            Coming soon
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-navy-900">
            Detailed product tour in progress
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Screens, workflows, and integration details are being finalized. In the
            meantime, book a demo to see the platform with your own caseload.
          </p>
        </div>
      </Section>

      <CTASection />
    </>
  );
}
