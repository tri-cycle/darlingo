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
  // 1) 전체 구간 경로를 API로 호출합니다.
  const all = await fetchBikeRoute(
    [ +startStation.stationLongitude, +startStation.stationLatitude ],
    [ +endStation.stationLongitude,   +endStation.stationLatitude   ]
  );
  const route = all.routes[0];

  // 2) 고정된 속도(13km/h)로 사용자가 입력한 시간(bikeTimeSec)만큼 갔을 때의 거리를 계산합니다.
  const FIXED_BIKE_SPEED_KMPH = 13; // ◀️◀️ 여기를 13으로 수정
  const speed_mps = (FIXED_BIKE_SPEED_KMPH * 1000) / 3600; // m/s 단위로 변환
  const allowedDist = speed_mps * bikeTimeSec; // 이 시간 동안 이동할 수 있는 최대 거리(m)

  // 3) 전체 경로를 따라가며 위에서 계산한 거리(allowedDist)에 해당하는 좌표를 찾습니다.
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

  // 4) 위에서 찾은 좌표에서 가장 가까운 대여소를 '환승 대여소'로 선택합니다.
  const transferStation = stations.reduce((prev, curr) => {
    const dPrev = haversine(tLat, tLng, prev.stationLatitude, prev.stationLongitude);
    const dCurr = haversine(tLat, tLng, curr.stationLatitude, curr.stationLongitude);
    return dPrev < dCurr ? prev : curr;
  });

  // 5) '출발→환승' 과 '환승→도착' 두 구간으로 경로를 분할하여 다시 API를 호출합니다.
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