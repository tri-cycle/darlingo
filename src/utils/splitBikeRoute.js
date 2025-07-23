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
  const all = await fetchBikeRoute([
    [ +startStation.stationLongitude, +startStation.stationLatitude ],
    [ +endStation.stationLongitude,   +endStation.stationLatitude   ]
  ]);
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

  // 5) 환승 지점을 포함한 경로를 한 번만 조회한 뒤 구간을 분할합니다.
  const multi = await fetchBikeRoute([
    [ +startStation.stationLongitude, +startStation.stationLatitude ],
    [ +transferStation.stationLongitude, +transferStation.stationLatitude ],
    [ +endStation.stationLongitude,       +endStation.stationLatitude     ],
  ]);

  const full = multi.routes[0];
  const allCoords = polyline.decode(full.geometry); // 전체 경로 좌표
  const wp = full.way_points; // 각 지점의 geometry index
  const segInfo = full.segments; // 세그먼트 정보

  const coords1 = allCoords.slice(wp[0], wp[1] + 1);
  const coords2 = allCoords.slice(wp[1], wp[2] + 1);

  const segment1 = {
    routes: [
      {
        geometry: polyline.encode(coords1, 5),
        summary: { distance: segInfo[0].distance, duration: segInfo[0].duration },
      },
    ],
  };

  const segment2 = {
    routes: [
      {
        geometry: polyline.encode(coords2, 5),
        summary: { distance: segInfo[1].distance, duration: segInfo[1].duration },
      },
    ],
  };

  return { segment1, segment2, transferStation };
}