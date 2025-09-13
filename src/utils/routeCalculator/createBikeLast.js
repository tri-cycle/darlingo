import { fetchOdsayRoute } from "../fetchOdsayRoute";
import polyline from "polyline";
import { ROUTE_COLORS } from "../routeColors";
import { processOdsayPath } from "./processOdsayPath";
import { getTotalTime, addNamesToSummary } from "./helpers";

/**
 * 대중교통 이용 후 자전거로 마무리하는 경로를 생성한다.
 * @param {Object} params - 파라미터.
 * @param {{lat:number,lng:number,name?:string}} params.start - 시작 지점.
 * @param {{lat:number,lng:number,name?:string}} params.end - 도착 지점.
 * @param {Object} params.endStation - 도착 대여소.
 * @param {Object} params.transferStation - 환승 대여소.
 * @param {Object} params.segment1 - 자전거 경로 정보.
 * @param {number} params.bikeTimeSec - 자전거 이용 시간(초).
 * @param {number} [params.pathIndex=0] - Odsay 경로 인덱스.
 * @returns {Promise<{segments:Array, summary:Object}|null>} 생성된 경로 정보. 실패 시 null.
 */
export async function createBikeLast({
  start,
  end,
  endStation,
  transferStation,
  segment1,
  bikeTimeSec,
  pathIndex = 0,
}) {
  try {
    if (!endStation || !transferStation || !segment1?.routes?.[0]?.summary) return null;

    const resStart = await fetchOdsayRoute(
      { y: start.lat, x: start.lng },
      { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }
    );
    const startPath = resStart?.result?.path?.[pathIndex];
    if (!startPath) return null;
    const startSegments = await processOdsayPath(
      startPath,
      start,
      { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude }
    );
    if (startSegments === null) return null;

    const { distance } = segment1.routes[0].summary;
    const bikeTimeMin = Math.max(1, Math.round(bikeTimeSec / 60));
    const bikeSubPath = {
      trafficType: 4,
      laneColor: ROUTE_COLORS.BIKE,
      startName: transferStation.stationName.replace(/^\d+\.\s*/, ""),
      endName: endStation.stationName.replace(/^\d+\.\s*/, ""),
      sectionTime: bikeTimeMin,
      distance,
      avgSpeed: 13,
    };
    const bikeCoords = polyline
      .decode(segment1.routes[0].geometry, 5)
      .reverse()
      .map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
    const bikeSegment = { type: "bike", color: ROUTE_COLORS.BIKE, coords: bikeCoords };

    const resEnd = await fetchOdsayRoute(
      { y: +endStation.stationLatitude, x: +endStation.stationLongitude },
      { y: end.lat, x: end.lng }
    );
    const endPath = resEnd?.result?.path?.[pathIndex];
    if (!endPath) return null;
    const endSegments = await processOdsayPath(
      endPath,
      { lat: +endStation.stationLatitude, lng: +endStation.stationLongitude },
      end
    );
    if (endSegments === null) return null;

    const summary = {
      info: { totalTime: getTotalTime(startPath) + bikeTimeMin + getTotalTime(endPath) },
      subPath: [...(startPath.subPath || []), bikeSubPath, ...(endPath.subPath || [])],
    };
    addNamesToSummary(summary, start, end);
    return { segments: [...startSegments, bikeSegment, ...endSegments], summary };
  } catch (error) {
    console.error("createBikeLast 실패:", error);
    return null;
  }
}

