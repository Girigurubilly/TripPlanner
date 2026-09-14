import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  CalendarRange,
  FolderOpen,
  Map,
  MapPinned,
  NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/store/trip-store";
import { useI18n } from "@/i18n";
import { tripDestinationLabel } from "@/lib/trip-label";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

const TRIP_NAV = [
  { suffix: "", labelKey: "nav.overview" as const, icon: NotebookPen },
  { suffix: "/plan", labelKey: "nav.plan" as const, icon: CalendarRange },
  { suffix: "/places", labelKey: "nav.places" as const, icon: MapPinned },
  { suffix: "/map", labelKey: "nav.map" as const, icon: Map },
  { suffix: "/bookings", labelKey: "nav.bookings" as const, icon: FolderOpen },
  { suffix: "/insights", labelKey: "nav.insights" as const, icon: Activity },
];

export function AppShell({
  children,
  tripId,
}: {
  children: React.ReactNode;
  tripId?: string;
}) {
  const trip = useTripStore((s) => s.trips.find((t) => t.id === tripId));
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t, locale } = useI18n();

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-3 sm:px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-fg">
              <MapPinned className="size-3.5" />
            </span>
            <span className={cn("font-display text-lg tracking-tight", trip && "hidden sm:inline")}>{t("brand")}</span>
          </Link>
          {trip ? (
            <div className="hidden min-w-0 items-center gap-2 text-sm text-muted md:flex">
              <span className="text-line-strong">/</span>
              <span className="truncate text-ink">{trip.name}</span>
            </div>
          ) : null}
          {trip ? (
            <p className="min-w-0 truncate text-sm text-ink-soft md:hidden">{trip.name}</p>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <nav className="hidden items-center gap-1 md:flex">
              <NavLink to="/" active={pathname === "/"}>
                {t("nav.trips")}
              </NavLink>
              <NavLink to="/places" active={pathname === "/places"}>
                {t("nav.library")}
              </NavLink>
            </nav>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {tripId && trip ? (
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line p-3 lg:flex">
            <p className="px-2 pt-1 pb-2 text-xs font-medium tracking-wider text-faint uppercase">
              {tripDestinationLabel(trip, locale)}
            </p>
            {TRIP_NAV.map((item) => {
              const to = item.suffix
                ? (`/trips/$tripId${item.suffix}` as "/trips/$tripId/plan" | "/trips/$tripId/places" | "/trips/$tripId/map" | "/trips/$tripId/bookings" | "/trips/$tripId/insights")
                : "/trips/$tripId";
              const href = `/trips/${tripId}${item.suffix}`;
              const active = item.suffix === "" ? pathname === href : pathname.startsWith(href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.labelKey}
                  to={to}
                  params={{ tripId }}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-md px-2.5 text-sm transition-colors duration-150",
                    active ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-surface-2",
                  )}
                >
                  <Icon className="size-4" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </aside>
        ) : null}

        <main className="min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8">{children}</main>
      </div>

      {tripId && trip ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden">
          <div className="grid grid-cols-6">
            {TRIP_NAV.map((item) => {
              const to = item.suffix
                ? (`/trips/$tripId${item.suffix}` as "/trips/$tripId/plan" | "/trips/$tripId/places" | "/trips/$tripId/map" | "/trips/$tripId/bookings" | "/trips/$tripId/insights")
                : "/trips/$tripId";
              const href = `/trips/${tripId}${item.suffix}`;
              const active = item.suffix === "" ? pathname === href : pathname.startsWith(href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.labelKey}
                  to={to}
                  params={{ tripId }}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-xs transition-colors duration-150",
                    active ? "text-accent" : "text-muted",
                  )}
                >
                  {active ? <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent" /> : null}
                  <Icon className={cn("size-5 transition-transform duration-150", active && "scale-110")} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
          <div className="grid grid-cols-2">
            <Link
              to="/"
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                pathname === "/" ? "text-accent" : "text-muted",
              )}
            >
              {pathname === "/" ? <span className="absolute inset-x-10 top-0 h-0.5 rounded-full bg-accent" /> : null}
              <NotebookPen className="size-5" />
              {t("nav.trips")}
            </Link>
            <Link
              to="/places"
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                pathname === "/places" ? "text-accent" : "text-muted",
              )}
            >
              {pathname === "/places" ? <span className="absolute inset-x-10 top-0 h-0.5 rounded-full bg-accent" /> : null}
              <MapPinned className="size-5" />
              {t("nav.library")}
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-md px-3 py-2 text-sm transition-colors duration-150",
        active ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-surface-2",
      )}
    >
      {children}
    </Link>
  );
}
