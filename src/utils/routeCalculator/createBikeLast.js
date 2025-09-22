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

function selectPathsWithTransitPreference(
  paths = [],
  { pathIndex = 0, maxPaths = DEFAULT_PATH_LIMIT, label = "" } = {}
) {
  const normalizedPaths = Array.isArray(paths) ? paths : [];
  if (!normalizedPaths.length) return [];

  const transitCandidates = normalizedPaths.filter(path =>
    hasTransitSegment(path?.subPath)
  );

  const selectedTransit = transitCandidates.slice(
    pathIndex,
    pathIndex + maxPaths
  );

  if (selectedTransit.length >= maxPaths) {
    return selectedTransit.slice(0, maxPaths);
  }

  const result = [...selectedTransit];
  const fallbackUsed = [];

  for (const path of normalizedPaths) {
    if (result.includes(path)) continue;
    result.push(path);
    fallbackUsed.push(path);
    if (result.length >= maxPaths) break;
  }

  const messagePrefix = label ? `${label}:` : "createBikeLast";
  console.warn(
    `${messagePrefix} 대중교통 환승 경로가 충분하지 않습니다.`,
    {
      requested: maxPaths,
      pathIndex,
      availableTransit: transitCandidates.length,
      fallbackUsed: fallbackUsed.length,
      totalPaths: normalizedPaths.length,
    }
  );

  return result.slice(0, maxPaths);
}

/**
 * 대중교통 이용 후 자전거로 마무리하는 경로를 생성한다.
 * @param {Object} params - 파라미터.
 * @param {{lat:number,lng:number,name?:string}} params.start - 시작 지점.
 * @param {{lat:number,lng:number,name?:string}} params.end - 도착 지점.
 * @param {Object} params.endStation - 도착 대여소.
 * @param {Object} params.transferStation - 환승 대여소.
 * @param {Object} params.segment1 - 자전거 경로 정보.
 * @param {number} params.bikeTimeSec - 자전거 이용 시간(초).
 * @param {number} [params.pathIndex=0] - 시작 인덱스.
 * @param {number} [params.maxPaths=3] - 고려할 최대 경로 수.
 * @returns {Promise<Array<{segments:Array, summary:Object}>>} 생성된 경로 후보 목록.
 */
export async function createBikeLast({
  start,
  end,
  endStation,
  transferStation,
  segment1,
  bikeTimeSec,
  pathIndex = 0,
  maxPaths = DEFAULT_PATH_LIMIT,
}) {
  try {
    if (!endStation || !transferStation || !segment1?.routes?.[0]?.summary) return [];

    const resStart = await fetchOdsayRoute(
      { y: start.lat, x: start.lng },
      { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }
    );
    const resEnd = await fetchOdsayRoute(
      { y: +endStation.stationLatitude, x: +endStation.stationLongitude },
      { y: end.lat, x: end.lng }
    );

    const startPaths = selectPathsWithTransitPreference(resStart?.result?.path, {
      pathIndex,
      maxPaths,
      label: "createBikeLast/startPaths",
    });
    const endPaths = selectPathsWithTransitPreference(resEnd?.result?.path, {
      pathIndex,
      maxPaths,
      label: "createBikeLast/endPaths",
    });

    if (!startPaths.length || !endPaths.length) return [];

    const processedStartPaths = [];
    for (const startPath of startPaths) {
      const startSegments = await processOdsayPath(
        startPath,
        start,
        { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude }
      );
      if (startSegments === null) continue;
      processedStartPaths.push({ path: startPath, segments: startSegments });
    }

    const processedEndPaths = [];
    for (const endPath of endPaths) {
      const endSegments = await processOdsayPath(
        endPath,
        { lat: +endStation.stationLatitude, lng: +endStation.stationLongitude },
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
    console.error("createBikeLast 실패:", error);
    return [];
  }
}

