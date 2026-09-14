import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type ComboboxItem = {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
};

export function Combobox({
  value,
  displayValue,
  onChange,
  items,
  placeholder,
  allowCustom = true,
  customLabel,
  emptyText,
  loadingText,
  disabled,
  className,
  inputClassName,
  onQueryChange,
  filterLocal = true,
  clearOnFocus = true,
}: {
  value: string;
  displayValue?: string;
  onChange: (next: string, item?: ComboboxItem) => void;
  items: ComboboxItem[];
  placeholder?: string;
  allowCustom?: boolean;
  customLabel?: (query: string) => string;
  emptyText?: string;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  onQueryChange?: (query: string) => void;
  filterLocal?: boolean;
  clearOnFocus?: boolean;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; bottom: number } | null>(null);
  const editing = open;

  const shown = displayValue ?? value;
  const inputValue = editing ? query : shown;

  const filtered = useMemo(() => {
    if (!filterLocal) return items;
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 80);
    return items
      .filter((item) =>
        [item.id, item.label, item.description].filter(Boolean).join(" ").toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [filterLocal, items, query]);

  const canCustom =
    allowCustom &&
    query.trim() &&
    !filtered.some((item) => item.id.toLowerCase() === query.trim().toLowerCase() || item.label.toLowerCase() === query.trim().toLowerCase());

  function syncRect() {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, bottom: r.bottom });
  }

  useEffect(() => {
    if (!open) return;
    syncRect();
    const onScroll = () => syncRect();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  function commitItem(item: ComboboxItem) {
    onChange(item.id, item);
    setQuery("");
    setOpen(false);
  }

  function commitCustom() {
    const next = query.trim();
    if (!next || !allowCustom) return;
    onChange(next);
    setQuery("");
    setOpen(false);
  }

  const panel =
    open && rect && typeof document !== "undefined"
      ? createPortal(
          <div
            id={listId}
            role="listbox"
            className="fixed z-50 overflow-hidden rounded-lg border border-line bg-surface shadow-lift"
            style={{
              top: Math.min(rect.bottom + 4, window.innerHeight - 16),
              left: rect.left,
              width: Math.max(rect.width, 220),
              maxHeight: Math.min(280, window.innerHeight - rect.bottom - 12),
            }}
          >
            <ul className="max-h-64 overflow-y-auto p-1">
              {filtered.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2.5 py-2.5 text-left text-sm",
                      index === active ? "bg-accent-soft" : "hover:bg-surface-2",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => commitItem(item)}
                  >
                    {item.icon ? <span className="mt-0.5 shrink-0 text-accent">{item.icon}</span> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.label}</span>
                      {item.description ? (
                        <span className="block truncate text-xs text-muted">{item.description}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
              {canCustom ? (
                <li>
                  <button
                    type="button"
                    className="flex w-full rounded-md px-2.5 py-2.5 text-left text-sm hover:bg-surface-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={commitCustom}
                  >
                    {customLabel ? customLabel(query.trim()) : query.trim()}
                  </button>
                </li>
              ) : null}
              {!filtered.length && !canCustom ? (
                <li className="px-3 py-3 text-sm text-muted">{loadingText || emptyText}</li>
              ) : null}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        value={inputValue}
        placeholder={placeholder}
        className={cn("h-11 pr-9 sm:h-10", inputClassName)}
        onFocus={() => {
          setQuery(clearOnFocus ? "" : shown);
          setOpen(true);
          setActive(0);
          onQueryChange?.(clearOnFocus ? "" : shown);
        }}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          setActive(0);
          onQueryChange?.(next);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!wrapRef.current?.contains(document.activeElement)) {
              if (allowCustom && query.trim() && query.trim() !== shown) commitCustom();
              else setOpen(false);
            }
          }, 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[active]) commitItem(filtered[active]);
            else commitCustom();
          } else if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      />
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-faint" />
      {panel}
    </div>
  );
}
