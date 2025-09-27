// src/utils/splitBikeRoute.js
import polyline from "polyline";
import { fetchBikeRoute } from "./fetchBikeRoute";
import haversine from "./haversine";

const cache = new Map();

export function clearTimedBikeSegmentsCache() {
  cache.clear();
}

export async function fetchTimedBikeSegments(
  startStation,
  endStation,
  stations,
  bikeTimeSec
) {
  const key = `${startStation.stationId}-${endStation.stationId}-${bikeTimeSec}`;
  if (cache.has(key)) {
    return cache.get(key);
  }

  const promise = (async () => {
    const all = await fetchBikeRoute([
      [+startStation.stationLongitude, +startStation.stationLatitude],
      [+endStation.stationLongitude, +endStation.stationLatitude],
    ]);
    const route = all.routes[0];

    const FIXED_BIKE_SPEED_KMPH = 13;
    const speed_mps = (FIXED_BIKE_SPEED_KMPH * 1000) / 3600;
    const allowedDist = speed_mps * bikeTimeSec;

    const coords = polyline.decode(route.geometry);
    let cumDist = 0;
    let idx = coords.findIndex((_, i) => {
      if (i === 0) return false;
      const [lat1, lng1] = coords[i - 1];
      const [lat2, lng2] = coords[i];
      cumDist += haversine(lat1, lng1, lat2, lng2);
      return cumDist >= allowedDist;
    });
    if (idx === -1) idx = coords.length - 1;
    const [tLat, tLng] = coords[idx];

    const closestStation = stations.reduce((prev, curr) => {
      const dPrev = haversine(tLat, tLng, parseFloat(prev.stationLatitude), parseFloat(prev.stationLongitude));
      const dCurr = haversine(tLat, tLng, parseFloat(curr.stationLatitude), parseFloat(curr.stationLongitude));
      return dPrev < dCurr ? prev : curr;
    });

    return [closestStation];
  })();

  cache.set(key, promise);
  const result = await promise;
  cache.set(key, result);
  return result;
}