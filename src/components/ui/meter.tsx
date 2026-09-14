import { cn } from "@/lib/utils";

export function Meter({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-surface-2", className)} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn("h-full rounded-full bg-accent transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
