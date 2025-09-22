import { fetchOdsayRoute } from "../fetchOdsayRoute";
import polyline from "polyline";
import { ROUTE_COLORS } from "../routeColors";
import { processOdsayPath } from "./processOdsayPath";
import { getTotalTime, addNamesToSummary } from "./helpers";

const DEFAULT_PATH_LIMIT = 3;
const TRANSIT_TYPES = new Set([1, 2]);

function cloneSubPath(subPath = []) {
  return subPath.map(path => ({ ...path }));
}

function hasTransitSegment(subPath = []) {
  return subPath.some(path => path && TRANSIT_TYPES.has(path.trafficType));
}

/**
 * 자전거를 먼저 이용한 후 대중교통으로 환승하는 경로를 생성한다.
 * @param {Object} params - 파라미터.
 * @param {{lat:number,lng:number,name?:string}} params.start - 시작 지점.
 * @param {{lat:number,lng:number,name?:string}} params.end - 도착 지점.
 * @param {Object} params.startStation - 시작 대여소.
 * @param {Object} params.transferStation - 환승 대여소.
 * @param {Object} params.segment1 - 자전거 경로 정보.
 * @param {number} params.bikeTimeSec - 자전거 이용 시간(초).
 * @param {number} [params.pathIndex=0] - 시작 인덱스.
 * @param {number} [params.maxPaths=3] - 고려할 최대 경로 수.
 * @returns {Promise<Array<{segments:Array, summary:Object}>>} 생성된 경로 후보 목록.
 */
export async function createBikeFirst({
  start,
  end,
  startStation,
  transferStation,
  segment1,
  bikeTimeSec,
  pathIndex = 0,
  maxPaths = DEFAULT_PATH_LIMIT,
}) {
  try {
    if (!startStation || !transferStation || !segment1?.routes?.[0]?.summary) return [];

    const resStart = await fetchOdsayRoute(
      { y: start.lat, x: start.lng },
      { y: +startStation.stationLatitude, x: +startStation.stationLongitude }
    );
    const resEnd = await fetchOdsayRoute(
      { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude },
      { y: end.lat, x: end.lng }
    );

    const startPaths = (resStart?.result?.path || []).slice(pathIndex, pathIndex + maxPaths);
    const endPaths = (resEnd?.result?.path || []).slice(pathIndex, pathIndex + maxPaths);

    if (!startPaths.length || !endPaths.length) return [];

    const processedStartPaths = [];
    for (const startPath of startPaths) {
      const startSegments = await processOdsayPath(
        startPath,
        start,
        { lat: +startStation.stationLatitude, lng: +startStation.stationLongitude }
      );
      if (startSegments === null) continue;
      processedStartPaths.push({ path: startPath, segments: startSegments });
    }

    const processedEndPaths = [];
    for (const endPath of endPaths) {
      const endSegments = await processOdsayPath(
        endPath,
        { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude },
        end
      );
      if (endSegments === null) continue;
      processedEndPaths.push({ path: endPath, segments: endSegments });
    }

    if (!processedStartPaths.length || !processedEndPaths.length) return [];

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

    const candidates = [];

    for (const { path: startPath, segments: startSegments } of processedStartPaths) {
      for (const { path: endPath, segments: endSegments } of processedEndPaths) {
        const combinedSubPath = [
          ...cloneSubPath(startPath.subPath || []),
          { ...bikeSubPath },
          ...cloneSubPath(endPath.subPath || []),
        ];

        if (!hasTransitSegment(combinedSubPath)) continue;

        const summary = {
          info: {
            totalTime: getTotalTime(startPath) + bikeTimeMin + getTotalTime(endPath),
          },
          subPath: combinedSubPath,
        };
        addNamesToSummary(summary, start, end);
        candidates.push({
          segments: [...startSegments, { ...bikeSegment }, ...endSegments],
          summary,
        });
      }
    }

    return candidates;
  } catch (error) {
    console.error("createBikeFirst 실패:", error);
    return [];
  }
}

