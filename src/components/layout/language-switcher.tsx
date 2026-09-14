import { Check, Globe } from "lucide-react";
import { LOCALES, LOCALE_META, useI18n, type Locale } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={cn("min-h-11 min-w-11 shrink-0", !compact && "gap-1.5 px-2.5 sm:min-h-9")}
          aria-label={t("language.label")}
        >
          <Globe className="size-4" />
          {!compact ? (
            <span className="hidden text-xs font-medium sm:inline">{LOCALE_META[locale].native}</span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {LOCALES.map((code: Locale) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => setLocale(code)}
            className={cn("min-h-11 justify-between sm:min-h-9", code === locale && "bg-accent-soft text-accent")}
          >
            <span>{LOCALE_META[code].native}</span>
            {code === locale ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
