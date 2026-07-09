import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Section, SectionHeading } from "@/components/Section";
import { CTASection } from "@/components/CTASection";
import { CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Compliance",
  description:
    "How SevynDay helps Ontario employers meet AODA, Human Rights Code, ESA, and privacy obligations with a defensible audit trail.",
};

const frameworks = [
  {
    name: "AODA",
    detail:
      "Workflows aligned to the Integrated Accessibility Standards, including individual accommodation and return-to-work plan requirements.",
  },
  {
    name: "Ontario Human Rights Code",
    detail:
      "Duty-to-accommodate processes with documented consideration up to the point of undue hardship.",
  },
  {
    name: "Employment Standards Act",
    detail:
      "Statutory leave eligibility, entitlements, and reinstatement rules encoded into case tracking.",
  },
  {
    name: "Privacy (PHIPA / PIPEDA)",
    detail:
      "Consent capture, role-scoped access, and Canadian data residency for sensitive health information.",
  },
];

export default function CompliancePage() {
  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Compliance you can defend, documented as you work"
        description="SevynDay is built around the obligations Ontario employers actually face — so the audit trail is a byproduct of good process, not extra work."
      />

      <Section>
        <SectionHeading
          title="Frameworks we&rsquo;re built around"
          description="The platform encodes the rules HR teams are held to, and records the decisions that prove you followed them."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {frameworks.map((framework) => (
            <div
              key={framework.name}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-card"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-navy-900">
                    {framework.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {framework.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-slate-200 bg-slate-50">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">
            Placeholder
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-navy-900">
            Full compliance &amp; security documentation coming soon
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Detailed control descriptions, certifications, and our data-processing
            terms are being prepared for this page.
          </p>
        </div>
      </Section>

      <CTASection />
    </>
  );
}
