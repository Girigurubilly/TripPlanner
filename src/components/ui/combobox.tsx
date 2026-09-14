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
  appearance = "field",
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
  appearance?: "field" | "select";
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; bottom: number } | null>(null);
  const isSelect = appearance === "select";
  const editing = open && !isSelect;

  const shown = displayValue ?? value;
  const inputValue = editing ? query : shown;

  const filtered = useMemo(() => {
    if (!filterLocal) return items;
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 120);
    return items
      .filter((item) =>
        [item.id, item.label, item.description].filter(Boolean).join(" ").toLowerCase().includes(q),
      )
      .slice(0, 120);
  }, [filterLocal, items, query]);

  const canCustom =
    allowCustom &&
    query.trim() &&
    !filtered.some(
      (item) =>
        item.id.toLowerCase() === query.trim().toLowerCase() ||
        item.label.toLowerCase() === query.trim().toLowerCase(),
    );

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

  useEffect(() => {
    if (!open) return;
    if (isSelect) searchRef.current?.focus();
    const idx = filtered.findIndex((item) => item.id === value);
    if (idx >= 0) setActive(idx);
  }, [open, isSelect]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closePanel(true);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, query, allowCustom, shown]);

  useEffect(() => {
    if (!open) return;
    const selected = panelRef.current?.querySelector("[aria-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

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

  function closePanel(commit: boolean) {
    if (commit && allowCustom && query.trim() && query.trim() !== shown) {
      commitCustom();
      return;
    }
    setQuery("");
    setOpen(false);
  }

  function openPanel(seed = "") {
    setQuery(seed);
    setOpen(true);
    setActive(0);
    onQueryChange?.(seed);
  }

  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  const spaceAbove = rect?.top ?? 0;
  const openUp = Boolean(rect) && spaceBelow < 240 && spaceAbove > spaceBelow;
  const maxH = Math.min(320, Math.max(160, (openUp ? spaceAbove : spaceBelow) - 12));

  const list = (
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
  );

  const panel =
    open && rect && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            className="fixed z-50 overflow-hidden rounded-lg border border-line bg-surface shadow-lift"
            style={{
              left: rect.left,
              width: Math.max(rect.width, isSelect ? 260 : 220),
              maxHeight: maxH,
              ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            }}
          >
            {isSelect ? (
              <div className="border-b border-line p-1.5">
                <input
                  ref={searchRef}
                  value={query}
                  placeholder={placeholder}
                  className="h-9 w-full rounded-md border border-line bg-surface-2 px-2.5 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onChange={(e) => {
                    const next = e.target.value;
                    setQuery(next);
                    setActive(0);
                    onQueryChange?.(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (filtered[active]) commitItem(filtered[active]);
                      else commitCustom();
                    } else if (e.key === "Escape") {
                      closePanel(false);
                    }
                  }}
                />
              </div>
            ) : null}
            {list}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {isSelect ? (
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          className={cn(
            "relative flex h-11 w-full items-center gap-2 rounded-md border border-line bg-surface px-3 pr-9 text-left text-sm text-ink shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10",
            inputClassName,
          )}
          onClick={() => {
            if (disabled) return;
            if (open) closePanel(false);
            else openPanel("");
          }}
        >
          <span className={cn("min-w-0 flex-1 truncate", shown ? "text-ink" : "text-faint")}>
            {shown || placeholder}
          </span>
          <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-faint" />
        </button>
      ) : (
        <>
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
              openPanel(clearOnFocus ? "" : shown);
            }}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              setOpen(true);
              setActive(0);
              onQueryChange?.(next);
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
                closePanel(false);
                inputRef.current?.blur();
              }
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={placeholder}
            disabled={disabled}
            className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-faint hover:text-ink"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (disabled) return;
              if (open) closePanel(false);
              else inputRef.current?.focus();
            }}
          >
            <ChevronsUpDown className="size-4" />
          </button>
        </>
      )}
      {panel}
    </div>
  );
}
