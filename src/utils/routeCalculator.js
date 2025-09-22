// src/utils/routeCalculator.js

import { fetchOdsayRoute } from "./fetchOdsayRoute";
import { fetchTimedBikeSegments } from "./splitBikeRoute";
import { fetchBikeRoute } from "./fetchBikeRoute";
import polyline from "polyline";
import { ROUTE_COLORS } from "./routeColors";
import { processOdsayPath } from "./routeCalculator/processOdsayPath";
import { createBikeFirst } from "./routeCalculator/createBikeFirst";
import { createBikeLast } from "./routeCalculator/createBikeLast";
import { prioritizeRoutes } from "./routeCalculator/prioritizeRoutes.js";
import {
  findNearestStation,
  getTotalTime,
  removeDuplicates,
  sortCandidates,
  addNamesToSummary,
} from "./routeCalculator/helpers";

const MAX_PUBLIC_TRANSIT_PATHS = 3;

// --- Main Calculation Logic ---

export async function calculateCombinedRoutes({ start, end, waypoints, stations }) {
  const viaPoints = waypoints.filter(Boolean);
  let finalRoutes = [];

  try {
    if (viaPoints.length > 0) {
      finalRoutes = await calculateWaypointRoutes({ start, end, viaPoints, stations });
    } else {
      finalRoutes = await calculateDirectRoutes({ start, end, stations });
    }
  } catch (error) {
    console.error("경로 계산 중 오류 발생:", error);
  }

  return prioritizeRoutes(finalRoutes).slice(0, 5);
}

async function calculateWaypointRoutes({ start, end, viaPoints }) {
  const candidates = [];
  const viaPoint = viaPoints[0];

  const resStart = await fetchOdsayRoute(
    { y: start.lat, x: start.lng },
    { y: viaPoint.lat, x: viaPoint.lng }
  );
  const resEnd = await fetchOdsayRoute(
    { y: viaPoint.lat, x: viaPoint.lng },
    { y: end.lat, x: end.lng }
  );
  const pathsStart = (resStart?.result?.path || []).slice(0, 2);
  const pathsEnd = (resEnd?.result?.path || []).slice(0, 2);

  for (const p1 of pathsStart) {
    for (const p2 of pathsEnd) {
      const seg1 = await processOdsayPath(p1, start, viaPoint);
      const seg2 = await processOdsayPath(p2, viaPoint, end);
      if (seg1 === null || seg2 === null) continue;
      const summary = {
        info: { totalTime: getTotalTime(p1) + getTotalTime(p2) },
        subPath: [...(p1.subPath || []), ...(p2.subPath || [])],
      };
      addNamesToSummary(summary, start, end);
      candidates.push({ segments: [...seg1, ...seg2], summary });
    }
  }

  try {
    const bikeData = await fetchBikeRoute([start, ...viaPoints, end].map(p => [p.lng, p.lat]));
    if (bikeData?.routes?.[0]) {
      const {
        geometry,
        summary: { distance, duration },
      } = bikeData.routes[0];
      const bikeCoords = polyline
        .decode(geometry, 5)
        .map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
      const sectionTime = Math.round(duration / 60);
      const summaryBike = {
        info: { totalTime: sectionTime },
        subPath: [
          {
            trafficType: 4,
            laneColor: ROUTE_COLORS.BIKE,
            startName: start.name,
            endName: end.name,
            sectionTime,
            distance,
            avgSpeed: (distance / 1000) / (duration / 3600),
          },
        ],
      };
      candidates.push({
        segments: [{ type: "bike", color: ROUTE_COLORS.BIKE, coords: bikeCoords }],
        summary: summaryBike,
      });
    }
  } catch (e) {
    console.error("전체 자전거 경로 조회 실패:", e);
  }

  return sortCandidates(removeDuplicates(candidates));
}

async function calculateDirectRoutes({ start, end, stations }) {
  let allCandidates = [];
  let mixedRouteCount = 0;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    const bikeTimeSec = 900 + attempt * 900;
    const currentCandidates = [];

    if (attempt === 0) {
      const res = await fetchOdsayRoute(
        { y: start.lat, x: start.lng },
        { y: end.lat, x: end.lng }
      );
      if (res?.result?.path) {
        for (const p of res.result.path.slice(0, 5)) {
          const segments = await processOdsayPath(p, start, end);
          if (segments === null) continue;
          addNamesToSummary(p, start, end);
          currentCandidates.push({ segments, summary: p });
        }
      }
    }

    const startStation = findNearestStation(start, stations);
    const endStation = findNearestStation(end, stations);

    if (startStation && endStation && startStation.stationId !== endStation.stationId) {
      try {
        const forward = await fetchTimedBikeSegments(
          startStation,
          endStation,
          stations,
          bikeTimeSec
        );

        if (forward?.segment1 && forward?.transferStation) {
          const candidatesForward = await createBikeFirst({
            start,
            end,
            startStation,
            transferStation: forward.transferStation,
            segment1: forward.segment1,
            bikeTimeSec,
            maxPaths: MAX_PUBLIC_TRANSIT_PATHS,
          });
          currentCandidates.push(...candidatesForward);
        }

        const backward = await fetchTimedBikeSegments(
          endStation,
          startStation,
          stations,
          bikeTimeSec
        );

        if (backward?.segment1 && backward?.transferStation) {
          const candidatesBackward = await createBikeLast({
            start,
            end,
            endStation,
            transferStation: backward.transferStation,
            segment1: backward.segment1,
            bikeTimeSec,
            maxPaths: MAX_PUBLIC_TRANSIT_PATHS,
          });
          currentCandidates.push(...candidatesBackward);
        }
      } catch (e) {
        console.error(`자전거 경로 생성 실패 (시간: ${bikeTimeSec}s):`, e);
      }
    }

    allCandidates.push(...currentCandidates);

    const sortedCandidates = sortCandidates(removeDuplicates(allCandidates));
    allCandidates = sortedCandidates;

    mixedRouteCount = sortedCandidates.reduce((count, candidate) => {
      const subPaths = candidate?.summary?.subPath || [];
      const hasBike = subPaths.some(path => path?.trafficType === 4);
      const hasNonBike = subPaths.some(path => path?.trafficType !== 4);
      return hasBike && hasNonBike ? count + 1 : count;
    }, 0);

    const triedAllScenarios = attempt >= MAX_ATTEMPTS;
    const hasEnoughMixedRoutes = mixedRouteCount >= 5;
    if (triedAllScenarios || hasEnoughMixedRoutes) break;
  }
  const sortedCandidates = sortCandidates(removeDuplicates(allCandidates));
  return prioritizeRoutes(sortedCandidates);
}

