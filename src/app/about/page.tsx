import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Section, SectionHeading } from "@/components/Section";
import { CTASection } from "@/components/CTASection";

export const metadata: Metadata = {
  title: "About",
  description:
    "SevynDay builds disability and absence management software for Ontario employers.",
};

const values = [
  {
    title: "Employers first",
    description:
      "We build for the HR and disability-management teams who carry real legal and human responsibility every day.",
  },
  {
    title: "Compliance is not optional",
    description:
      "Ontario&rsquo;s obligations are the foundation of the product, not a checkbox bolted on at the end.",
  },
  {
    title: "Dignity in every case",
    description:
      "Behind every record is a person navigating a hard moment. The workflow should respect that.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Built for the people who manage the hardest moments at work"
        description="SevynDay is on a mission to make disability and absence management humane, compliant, and effortless for Ontario employers."
      />

      <Section>
        <SectionHeading
          title="What we believe"
          description="A few principles that shape how we build."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-card"
            >
              <h3 className="text-lg font-semibold text-navy-900">{value.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {value.description}
              </p>
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
            Team &amp; company story coming soon
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Leadership bios, our story, and careers information will live here.
          </p>
        </div>
      </Section>

      <CTASection />
    </>
  );
}
