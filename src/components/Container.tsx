import { cn } from "@/lib/cn";

type ContainerProps = {
  // React.ElementType (not `keyof JSX.IntrinsicElements`) so this stays valid
  // after @react-three/fiber globally augments JSX.IntrinsicElements with
  // three.js elements — some of which have required props. Behavior unchanged.
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
};

export function Container({ as: Tag = "div", className, children }: ContainerProps) {
  return <Tag className={cn("container-page", className)}>{children}</Tag>;
}
