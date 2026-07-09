"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "@/components/Container";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { primaryNav } from "@/lib/site";
import { cn } from "@/lib/cn";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setScrolledPastHero(true);
      return;
    }
    // On the home page the header stays hidden until the full-height hero has
    // scrolled past; then it fades/slides in.
    const onScroll = () => {
      setScrolledPastHero(window.scrollY > window.innerHeight - 80);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isHome]);

  // Over the home hero the header is invisible and non-interactive. On the home
  // page it is `fixed` (out of flow) so the hero sits flush at the very top;
  // elsewhere it is a normal sticky header.
  const hidden = isHome && !scrolledPastHero;

  return (
    <header
      className={cn(
        "z-40 bg-white/85 backdrop-blur transition-all duration-500",
        isHome ? "fixed inset-x-0 top-0" : "sticky top-0",
        hidden
          ? "pointer-events-none -translate-y-full border-b border-transparent opacity-0"
          : "translate-y-0 border-b border-slate-200/70 opacity-100",
      )}
      aria-hidden={hidden}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SevynDay home">
          <Logo className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight text-navy-900">
            SevynDay
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-navy-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button href="/demo" variant="primary" className="hidden sm:inline-flex">
            Book a demo
          </Button>
        </div>
      </Container>
    </header>
  );
}
