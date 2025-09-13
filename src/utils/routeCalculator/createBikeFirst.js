import { fetchOdsayRoute } from "../fetchOdsayRoute";
import polyline from "polyline";
import { ROUTE_COLORS } from "../routeColors";
import { processOdsayPath } from "./processOdsayPath";
import { getTotalTime, addNamesToSummary } from "./helpers";

/**
 * 자전거를 먼저 이용한 후 대중교통으로 환승하는 경로를 생성한다.
 * @param {Object} params - 파라미터.
 * @param {{lat:number,lng:number,name?:string}} params.start - 시작 지점.
 * @param {{lat:number,lng:number,name?:string}} params.end - 도착 지점.
 * @param {Object} params.startStation - 시작 대여소.
 * @param {Object} params.transferStation - 환승 대여소.
 * @param {Object} params.segment1 - 자전거 경로 정보.
 * @param {number} params.bikeTimeSec - 자전거 이용 시간(초).
 * @param {number} [params.pathIndex=0] - Odsay 경로 인덱스.
 * @returns {Promise<{segments:Array, summary:Object}|null>} 생성된 경로 정보. 실패 시 null.
 */
export async function createBikeFirst({
  start,
  end,
  startStation,
  transferStation,
  segment1,
  bikeTimeSec,
  pathIndex = 0,
}) {
  try {
    if (!startStation || !transferStation || !segment1?.routes?.[0]?.summary) return null;

    const resStart = await fetchOdsayRoute(
      { y: start.lat, x: start.lng },
      { y: +startStation.stationLatitude, x: +startStation.stationLongitude }
    );
    const startPath = resStart?.result?.path?.[pathIndex];
    if (!startPath) return null;
    const startSegments = await processOdsayPath(
      startPath,
      start,
      { lat: +startStation.stationLatitude, lng: +startStation.stationLongitude }
    );
    if (startSegments === null) return null;

    const { distance } = segment1.routes[0].summary;
    const bikeTimeMin = Math.max(1, Math.round(bikeTimeSec / 60));
    const bikeSubPath = {
      trafficType: 4,
      laneColor: ROUTE_COLORS.BIKE,
      startName: startStation.stationName.replace(/^\d+\.\s*/, ""),
      endName: transferStation.stationName.replace(/^\d+\.\s*/, ""),
      sectionTime: bikeTimeMin,
      distance,
      avgSpeed: 13,
    };
    const bikeCoords = polyline
      .decode(segment1.routes[0].geometry, 5)
      .map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
    const bikeSegment = { type: "bike", color: ROUTE_COLORS.BIKE, coords: bikeCoords };

    const resEnd = await fetchOdsayRoute(
      { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude },
      { y: end.lat, x: end.lng }
    );
    const endPath = resEnd?.result?.path?.[pathIndex];
    if (!endPath) return null;
    const endSegments = await processOdsayPath(
      endPath,
      { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude },
      end
    );
    if (endSegments === null) return null;

    const combinedSubPath = [...(startPath.subPath || []), bikeSubPath, ...(endPath.subPath || [])];
    const summary = {
      info: { totalTime: getTotalTime(startPath) + bikeTimeMin + getTotalTime(endPath) },
      subPath: combinedSubPath,
    };
    addNamesToSummary(summary, start, end);
    return { segments: [...startSegments, bikeSegment, ...endSegments], summary };
  } catch (error) {
    console.error("createBikeFirst 실패:", error);
    return null;
  }
}

