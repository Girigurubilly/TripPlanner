import { useMemo } from "react";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { parseTimeInput, TIME_SLOTS } from "@/lib/time-input";
import { useI18n } from "@/i18n";

export function TimeSelect({
  value,
  onChange,
  disabled,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const { t } = useI18n();
  const items = useMemo<ComboboxItem[]>(() => {
    const slots = TIME_SLOTS.includes(value) || !value ? TIME_SLOTS : [value, ...TIME_SLOTS];
    return slots.map((time) => ({ id: time, label: time }));
  }, [value]);

  return (
    <Combobox
      value={value}
      onChange={(next) => {
        const parsed = parseTimeInput(next);
        if (parsed) onChange(parsed);
      }}
      items={items}
      placeholder={t("newTrip.timePh")}
      customLabel={(q) => t("newTrip.useTime", { time: parseTimeInput(q) ?? q })}
      emptyText={t("newTrip.timeEmpty")}
      disabled={disabled}
      className={className}
      inputClassName={inputClassName}
      clearOnFocus={false}
    />
  );
}
