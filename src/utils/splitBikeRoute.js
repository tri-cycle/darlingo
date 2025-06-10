// src/utils/splitBikeRoute.js
import polyline from "polyline";
import { fetchBikeRoute } from "./fetchBikeRoute";
import haversine from "./haversine";

/**
 * 사용자가 입력한 시간에 맞춰 두 구간으로 분할된 자전거 경로를 가져옵니다.
 *
 * @param {Object} startStation  { stationLatitude, stationLongitude }
 * @param {Object} endStation    { stationLatitude, stationLongitude }
 * @param {Array}  stations      전체 대여소 배열
 * @param {number} bikeTimeSec   자전거 이용 시간(초)
 */
export async function fetchTimedBikeSegments(
  startStation,
  endStation,
  stations,
  bikeTimeSec
) {
  // 1) 전체 구간 경로 호출
  const all = await fetchBikeRoute(
    [ +startStation.stationLongitude, +startStation.stationLatitude ],
    [ +endStation.stationLongitude,   +endStation.stationLatitude   ]
  );
  const route = all.routes[0];
  const { distance, duration } = route.summary; // m, s
  const avgSpeed = distance / duration;         // m/s
  const allowedDist = avgSpeed * bikeTimeSec;   // m

  // 2) 폴리라인 디코딩 후 누적 거리 계산
  const coords = polyline.decode(route.geometry); // [[lat, lng], …]
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

  // 3) 환승 대여소 찾기 (폴리라인 지점 근처)
  const transferStation = stations.reduce((prev, curr) => {
    const dPrev = haversine(tLat, tLng, prev.stationLatitude, prev.stationLongitude);
    const dCurr = haversine(tLat, tLng, curr.stationLatitude, curr.stationLongitude);
    return dPrev < dCurr ? prev : curr;
  });

  // 4) 두 구간으로 분할된 경로 재호출
  const segment1 = await fetchBikeRoute(
    [ +startStation.stationLongitude, +startStation.stationLatitude ],
    [ +transferStation.stationLongitude, +transferStation.stationLatitude ]
  );
  const segment2 = await fetchBikeRoute(
    [ +transferStation.stationLongitude, +transferStation.stationLatitude ],
    [ +endStation.stationLongitude,       +endStation.stationLatitude     ]
  );

  return { segment1, segment2, transferStation };
}
