export const site = {
  name: "SevynDay",
  tagline: "Workplace disability & absence management, built for Ontario employers.",
  description:
    "SevynDay is the enterprise platform HR leaders use to manage disability, leave, and absence — with compliance, accommodation, and return-to-work workflows purpose-built for Ontario.",
  email: "hello@sevynday.com",
} as const;

export type NavItem = {
  label: string;
  href: string;
};

export const primaryNav: NavItem[] = [
  { label: "Product", href: "/product" },
  { label: "Compliance", href: "/compliance" },
  { label: "About", href: "/about" },
];
