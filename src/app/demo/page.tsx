import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "See SevynDay with your own caseload. Book a 30-minute walkthrough for your HR and disability-management team.",
};

const benefits = [
  "A walkthrough tailored to your disability and absence programs",
  "Answers on Ontario compliance, security, and data residency",
  "Guidance on rolling out alongside your existing HRIS",
];

const fieldClass =
  "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-200";

const labelClass = "block text-sm font-medium text-slate-700";

export default function DemoPage() {
  return (
    <section className="bg-slate-50">
      <Container className="grid gap-14 py-16 sm:py-24 lg:grid-cols-2">
        {/* Value column */}
        <div className="max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">
            Book a demo
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl">
            See SevynDay with your own caseload
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Tell us a little about your organization and we&rsquo;ll set up a
            30-minute walkthrough with a specialist — no slideware, just the
            platform.
          </p>

          <ul className="mt-8 space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span className="text-sm leading-relaxed text-slate-700">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form column */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
          {/* Placeholder form — not yet wired to a backend. */}
          <form className="grid gap-5" action="#" method="post">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className={labelClass}>
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="company" className={labelClass}>
                Company
              </label>
              <input
                id="company"
                name="company"
                type="text"
                autoComplete="organization"
                required
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="employees" className={labelClass}>
                Number of employees
              </label>
              <select id="employees" name="employees" className={fieldClass} defaultValue="">
                <option value="" disabled>
                  Select a range
                </option>
                <option>Under 250</option>
                <option>250 – 1,000</option>
                <option>1,000 – 5,000</option>
                <option>5,000+</option>
              </select>
            </div>

            <div>
              <label htmlFor="message" className={labelClass}>
                What are you hoping to solve? <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="message"
                name="message"
                rows={3}
                className={fieldClass}
              />
            </div>

            <button
              type="submit"
              className="mt-1 inline-flex w-full items-center justify-center rounded-md bg-navy-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
            >
              Request a demo
            </button>

            <p className="text-center text-xs text-slate-400">
              By submitting, you agree to be contacted about SevynDay. We&rsquo;ll
              never share your information.
            </p>
          </form>
        </div>
      </Container>
    </section>
  );
}
