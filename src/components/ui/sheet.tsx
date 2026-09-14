import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "right" | "left" | "bottom" }) {
  const { t } = useI18n();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/35 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface shadow-soft",
          side === "right" &&
            "inset-y-0 right-0 h-full w-[min(100%,420px)] border-l border-line max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:max-h-[88dvh] max-sm:w-full max-sm:rounded-t-xl max-sm:border-l-0 max-sm:border-t",
          side === "left" && "inset-y-0 left-0 h-full w-[min(100%,320px)] border-r border-line",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl border-t border-line pb-[env(safe-area-inset-bottom)]",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-3 right-3 grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 sm:size-8">
          <X className="size-4" />
          <span className="sr-only">{t("nav.close")}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
