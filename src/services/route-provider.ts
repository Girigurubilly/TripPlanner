import { estimateTravel, suggestMode } from "@/lib/geo";
import type { LatLng, RouteLeg, TransportMode } from "@/types/trip";

export interface RouteProvider {
  route(from: LatLng, to: LatLng, mode?: TransportMode, preferred?: TransportMode): Promise<RouteLeg>;
}

export class MockRouteProvider implements RouteProvider {
  async route(
    from: LatLng,
    to: LatLng,
    mode?: TransportMode,
    preferred: TransportMode = "transit",
  ): Promise<RouteLeg> {
    const chosen = mode ?? suggestMode(from, to, preferred);
    return estimateTravel(from, to, chosen);
  }
}

export const routeProvider: RouteProvider = new MockRouteProvider();
