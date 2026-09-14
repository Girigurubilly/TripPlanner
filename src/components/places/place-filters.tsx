import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/i18n";
import type { IndoorOutdoor, PlaceCategory, Priority } from "@/types/trip";

export type PlaceFilterState = {
  q: string;
  category: PlaceCategory | "all";
  neighbourhood: string;
  priority: Priority | "all";
  assigned: "all" | "assigned" | "unassigned";
  indoor: IndoorOutdoor | "all";
  hours: "all" | "known" | "unknown" | "open";
  tag: string;
};

export const EMPTY_FILTERS: PlaceFilterState = {
  q: "",
  category: "all",
  neighbourhood: "all",
  priority: "all",
  assigned: "all",
  indoor: "all",
  hours: "all",
  tag: "all",
};

export function PlaceFilters({
  value,
  onChange,
  neighbourhoods,
  tags,
}: {
  value: PlaceFilterState;
  onChange: (next: PlaceFilterState) => void;
  neighbourhoods: string[];
  tags: string[];
}) {
  const { t } = useI18n();
  const set = <K extends keyof PlaceFilterState>(key: K, v: PlaceFilterState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
      <Input
        value={value.q}
        onChange={(e) => set("q", e.target.value)}
        placeholder={t("places.search")}
        className="col-span-1 h-11 sm:col-span-2 sm:h-9"
      />
      <Select value={value.category} onChange={(e) => set("category", e.target.value as PlaceFilterState["category"])} className="h-11 sm:h-9">
        <option value="all">{t("places.allCategories")}</option>
        <option value="attraction">{t("category.attraction")}</option>
        <option value="restaurant">{t("category.restaurant")}</option>
        <option value="cafe">{t("category.cafe")}</option>
        <option value="photo">{t("category.photo")}</option>
        <option value="shopping">{t("category.shopping")}</option>
        <option value="nature">{t("category.nature")}</option>
        <option value="nightlife">{t("category.nightlife")}</option>
        <option value="hotel">{t("category.hotel")}</option>
        <option value="other">{t("category.other")}</option>
      </Select>
      <Select value={value.neighbourhood} onChange={(e) => set("neighbourhood", e.target.value)} className="h-11 sm:h-9">
        <option value="all">{t("places.allAreas")}</option>
        {neighbourhoods.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
      <Select value={value.priority} onChange={(e) => set("priority", e.target.value as PlaceFilterState["priority"])} className="h-11 sm:h-9">
        <option value="all">{t("places.allPriorities")}</option>
        <option value="must-do">{t("priority.must-do")}</option>
        <option value="want">{t("priority.want")}</option>
        <option value="if-time">{t("priority.if-time")}</option>
        <option value="skip">{t("priority.skip")}</option>
      </Select>
      <Select value={value.assigned} onChange={(e) => set("assigned", e.target.value as PlaceFilterState["assigned"])} className="h-11 sm:h-9">
        <option value="all">{t("places.assignedAll")}</option>
        <option value="assigned">{t("places.assigned")}</option>
        <option value="unassigned">{t("places.unassigned")}</option>
      </Select>
      <Select value={value.indoor} onChange={(e) => set("indoor", e.target.value as PlaceFilterState["indoor"])} className="h-11 sm:h-9">
        <option value="all">{t("places.indoorAll")}</option>
        <option value="indoor">{t("indoor.indoor")}</option>
        <option value="outdoor">{t("indoor.outdoor")}</option>
        <option value="mixed">{t("indoor.mixed")}</option>
      </Select>
      <Select value={value.hours} onChange={(e) => set("hours", e.target.value as PlaceFilterState["hours"])} className="h-11 sm:h-9">
        <option value="all">{t("places.anyHours")}</option>
        <option value="known">{t("places.hoursKnown")}</option>
        <option value="unknown">{t("places.hoursUnknown")}</option>
      </Select>
      {tags.length ? (
        <Select value={value.tag} onChange={(e) => set("tag", e.target.value)} className="h-11 sm:h-9">
          <option value="all">{t("places.allTags")}</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
