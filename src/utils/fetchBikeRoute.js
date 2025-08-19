// src/utils/fetchBikeRoute.js
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;

// in-memory cache: key is "lng,lat|lng,lat|..." for all waypoints
const cache = new Map();

// 최근 1분간 ORS 호출 시각을 저장하여 rate limit을 관리합니다.
const callTimes = [];
const LIMIT_PER_MINUTE = 40;

async function ensureRateLimit() {
  const now = Date.now();
  // 1분을 지난 호출 기록은 제거합니다.
  while (callTimes.length && now - callTimes[0] >= 60000) {
    callTimes.shift();
  }
  if (callTimes.length >= LIMIT_PER_MINUTE) {
    // 가장 오래된 호출로부터 1분이 지날 때까지 대기합니다.
    const waitMs = 60000 - (now - callTimes[0]) + 10;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return ensureRateLimit();
  }
  callTimes.push(Date.now());
}

// cache clear helper
export function clearBikeRouteCache() {
  cache.clear();
}

/**
 * ORS 자전거 경로를 조회합니다.
 *
 * @param {Array<Array<number>>} coordinates 경유지를 포함한 [lng, lat] 배열
 *   예: [[lng1, lat1], [lng2, lat2], ...]
 */
export async function fetchBikeRoute(
  coordinates,
  retries = 3,
  delay = 1000
) {
  const key = coordinates.map((c) => `${c[0]},${c[1]}`).join("|");
  if (cache.has(key)) {
    return cache.get(key);
  }

  const promise = (async () => {
    await ensureRateLimit();

    const res = await fetch(
      "https://api.openrouteservice.org/v2/directions/cycling-road/json",
      {
        method: "POST",
        headers: {
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          coordinates,
          instructions: false,
          options: {
            avoid_features: ["steps"],
            profile_params: { weightings: { steepness_difficulty: 0 } },
          },
        }),
      }
    );

    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && retries > 0) {
        await new Promise((r) => setTimeout(r, delay));
        return fetchBikeRoute(coordinates, retries - 1, delay * 2);
      }
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        `ORS HTTP ${res.status} (${errBody.error?.code || "unknown"}): ${
          errBody.error?.message || res.statusText
        }`
      );
    }

    const data = await res.json();
    return data;
  })().catch((err) => {
    cache.delete(key);
    throw err;
  });

  cache.set(key, promise);
  return promise;
}
