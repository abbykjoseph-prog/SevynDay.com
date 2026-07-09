import Link from "next/link";
import { Container } from "@/components/Container";
import { Logo } from "@/components/Logo";
import { site } from "@/lib/site";

const footerNav = [
  {
    heading: "Platform",
    links: [
      { label: "Product", href: "/product" },
      { label: "Compliance", href: "/compliance" },
      { label: "Book a demo", href: "/demo" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: `mailto:${site.email}` },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center gap-2.5" aria-label="SevynDay home">
            <Logo className="h-7 w-7" />
            <span className="text-lg font-semibold tracking-tight text-navy-900">
              SevynDay
            </span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            Disability, leave, and absence management for Ontario employers —
            compliant, auditable, and built for HR teams.
          </p>
        </div>

        {footerNav.map((col) => (
          <div key={col.heading}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {col.heading}
            </h3>
            <ul className="mt-4 space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-600 transition-colors hover:text-navy-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-slate-200">
        <Container className="flex flex-col items-start justify-between gap-2 py-6 text-xs text-slate-400 sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} SevynDay Inc. All rights reserved.</p>
          <p>Made for Ontario HR teams.</p>
        </Container>
      </div>
    </footer>
  );
}
