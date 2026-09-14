import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink shadow-none transition-colors placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
