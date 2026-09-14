import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface shadow-soft", className)}
      {...props}
    />
  );
}
