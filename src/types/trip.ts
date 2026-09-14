export type PlaceCategory =
  | "attraction"
  | "restaurant"
  | "cafe"
  | "hotel"
  | "photo"
  | "shopping"
  | "nature"
  | "nightlife"
  | "transport"
  | "other";

export type Priority = "must-do" | "want" | "if-time" | "skip";
export type PlaceStatus = "saved" | "planned" | "done" | "skipped";
export type TransportMode = "walk" | "transit" | "taxi" | "cycle";
export type IndoorOutdoor = "indoor" | "outdoor" | "mixed";
export type ReservationNeed = "yes" | "no" | "unknown";
export type PlaceSource = "manual" | "maps-url" | "search" | "import" | "maps-list";
export type TravelPace = "relaxed" | "moderate" | "packed";
export type DayLoad = "comfortable" | "busy" | "overloaded";
export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type DayHours = { open: string; close: string } | null;

export type OpeningHours = {
  days: Partial<Record<Weekday, DayHours>>;
  note?: string;
};

export type LatLng = { lat: number; lng: number };

export type Place = {
  id: string;
  name: string;
  googlePlaceId?: string;
  address: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  tags: string[];
  neighbourhood: string;
  priority: Priority;
  notes: string;
  source: PlaceSource;
  estimatedDurationMin: number;
  openingHours?: OpeningHours;
  reservationRequired: ReservationNeed;
  indoorOutdoor: IndoorOutdoor;
  photos: string[];
  status: PlaceStatus;
  createdAt: string;
};

export type HotelStay = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  notes: string;
};

export type TripDestination = {
  id: string;
  name: string;
  country: string;
  timezone: string;
  lat: number;
  lng: number;
  iata?: string;
};

export type Trip = {
  id: string;
  name: string;
  destination: string;
  destinations: TripDestination[];
  startDate: string;
  endDate: string;
  timezone: string;
  arrivalTime: string;
  departureTime: string;
  arrivalAirport?: string;
  departureAirport?: string;
  pace: TravelPace;
  preferredTransport: TransportMode;
  hotels: HotelStay[];
  placeIds: string[];
  notes: string;
  createdAt: string;
};

export type RouteLeg = {
  mode: TransportMode;
  durationMin: number;
  distanceM: number;
};

export type ItineraryItem = {
  id: string;
  tripId: string;
  placeId: string;
  date: string;
  order: number;
  startTime: string;
  endTime: string;
  durationMin: number;
  notes: string;
  priority: Priority;
  locked: boolean;
  transportFromPrevious?: RouteLeg;
  progressStatus: "pending" | "done" | "skipped";
};

export type BookingType =
  | "flight"
  | "hotel"
  | "train"
  | "ticket"
  | "restaurant"
  | "insurance"
  | "esim"
  | "transfer";

export type Booking = {
  id: string;
  tripId: string;
  type: BookingType;
  title: string;
  confirmationNumber: string;
  startAt: string;
  endAt: string;
  cancellationDeadline: string;
  notes: string;
  imageDataUrl: string;
  pdfUrl: string;
  itineraryItemId?: string;
  placeId?: string;
  status: "confirmed" | "pending" | "cancelled";
};

export type AlternatePlan = {
  id: string;
  tripId: string;
  label: string;
  description: string;
  dates: Record<string, string[]>;
};

export type PlaceSearchResult = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  neighbourhood: string;
  googlePlaceId?: string;
  estimatedDurationMin: number;
  openingHours?: OpeningHours;
  indoorOutdoor: IndoorOutdoor;
  reservationRequired: ReservationNeed;
  tags: string[];
  photos?: string[];
};

export type I18nParams = Record<string, string | number>;

export type OptimizationProposal = {
  id: string;
  kind: "move" | "reorder" | "assign" | "cluster";
  titleKey: "optimize.assignTitle" | "optimize.moveTitle" | "optimize.clusterTitle" | "optimize.reorderTitle";
  detailKey: "optimize.assignDetail" | "optimize.moveDetail" | "optimize.clusterDetail" | "optimize.reorderDetail";
  params: I18nParams;
  tripId: string;
  placeIds: string[];
  fromDate?: string;
  toDate?: string;
  suggestedOrder?: string[];
};

export type ConflictKind =
  | "overlap"
  | "short-buffer"
  | "checkout"
  | "unknown-hours"
  | "closed"
  | "arrival"
  | "departure";

export type PlanningConflict = {
  id: string;
  kind: ConflictKind;
  severity: "warn" | "error";
  itemId?: string;
  date: string;
  messageKey:
    | "conflict.overlap"
    | "conflict.shortBuffer"
    | "conflict.unknownHours"
    | "conflict.closed"
    | "conflict.checkout"
    | "conflict.arrival"
    | "conflict.departure";
  params: I18nParams;
};

export type DayStats = {
  date: string;
  activityMin: number;
  travelMin: number;
  walkDistanceM: number;
  load: DayLoad;
  itemCount: number;
};

export type AppBackup = {
  version: 1;
  exportedAt: string;
  places: Place[];
  trips: Trip[];
  items: ItineraryItem[];
  bookings: Booking[];
  alternatePlans: AlternatePlan[];
};

export const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
