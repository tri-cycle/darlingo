// src/utils/routeCalculator/createBikeFirst.js
import { fetchOdsayRoute } from "../fetchOdsayRoute";
import polyline from "polyline";
import { ROUTE_COLORS } from "../routeColors";
import { processOdsayPath } from "./processOdsayPath";
import { getTotalTime, addNamesToSummary } from "./helpers";
import { fetchBikeRoute } from "../fetchBikeRoute";

const DEFAULT_PATH_LIMIT = 3;

function cloneSubPath(subPath = []) {
  return subPath.map(path => ({ ...path }));
}

function selectPathsWithTransitPreference(
  paths = [],
  { pathIndex = 0, maxPaths = DEFAULT_PATH_LIMIT, label = "" } = {}
) {
  const normalizedPaths = Array.isArray(paths) ? paths : [];
  if (!normalizedPaths.length) return [];
  const selectedPaths = normalizedPaths.slice(pathIndex, pathIndex + maxPaths);
  if (selectedPaths.length < maxPaths) {
      const messagePrefix = label ? `${label}:` : "createBikeFirst";
      console.warn(
        `${messagePrefix} ODsay 경로가 충분하지 않습니다.`,
        { requested: maxPaths, pathIndex, available: normalizedPaths.length }
      );
  }
  return selectedPaths;
}

export async function createBikeFirst({
  start,
  end,
  startStation,
  transferStation,
  bikeTimeSec,
  pathIndex = 0,
  maxPaths = DEFAULT_PATH_LIMIT,
}) {
  try {
    if (!startStation || !transferStation) return [];
    
    const segment1 = await fetchBikeRoute([
        [+startStation.stationLongitude, +startStation.stationLatitude],
        [+transferStation.stationLongitude, +transferStation.stationLatitude],
    ]);
    if (!segment1?.routes?.[0]?.summary) return [];

    const resStart = await fetchOdsayRoute(
      { y: start.lat, x: start.lng },
      { y: +startStation.stationLatitude, x: +startStation.stationLongitude }
    );
    const resEnd = await fetchOdsayRoute(
      { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude },
      { y: end.lat, x: end.lng }
    );

    const startPaths = selectPathsWithTransitPreference(resStart?.result?.path, {
      pathIndex, maxPaths, label: "createBikeFirst/startPaths",
    });
    const endPaths = selectPathsWithTransitPreference(resEnd?.result?.path, {
      pathIndex, maxPaths, label: "createBikeFirst/endPaths",
    });

    if (!startPaths.length || !endPaths.length) return [];

    const processedStartPaths = [];
    for (const startPath of startPaths) {
      const startSegments = await processOdsayPath(
        startPath, start,
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
    
    const { distance, duration } = segment1.routes[0].summary;
    const bikeTimeMin = Math.max(1, Math.round(duration / 60));
    const avgSpeed = (distance / 1000) / (duration / 3600) || 13;

    const bikeSubPath = {
      trafficType: 4,
      laneColor: ROUTE_COLORS.BIKE,
      startName: startStation.stationName.replace(/^\d+\.\s*/, ""),
      endName: transferStation.stationName.replace(/^\d+\.\s*/, ""),
      sectionTime: bikeTimeMin,
      distance,
      avgSpeed: avgSpeed,
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

        const summary = {
          info: { totalTime: getTotalTime(startPath) + bikeTimeMin + getTotalTime(endPath) },
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
    console.error(`createBikeFirst 실패 (환승: ${transferStation?.stationName}):`, error);
    return [];
  }
}