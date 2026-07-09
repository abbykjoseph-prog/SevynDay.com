import { Container } from "@/components/Container";
import { Button } from "@/components/Button";

export function CTASection() {
  return (
    <section className="bg-navy-900">
      <Container className="py-16 sm:py-20">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              See SevynDay with your own caseload.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-navy-100">
              A 30-minute walkthrough tailored to your organization&rsquo;s
              disability and absence programs. No slideware — just the platform.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button href="/demo" variant="primary" className="bg-white text-navy-900 hover:bg-navy-50">
              Book a demo
            </Button>
            <Button
              href="/product"
              variant="ghost"
              className="text-white hover:bg-white/10"
            >
              Explore the product
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
