import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
        className,
      )}
      {...props}
    />
  );
}
