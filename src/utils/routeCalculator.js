// src/utils/routeCalculator.js

import { fetchOdsayRoute } from "./fetchOdsayRoute";
import { fetchTimedBikeSegments } from "./splitBikeRoute";
import { fetchBikeRoute } from "./fetchBikeRoute";
import polyline from "polyline";
import { ROUTE_COLORS } from "./routeColors";
import { processOdsayPath } from "./routeCalculator/processOdsayPath";
import { createBikeFirst } from "./routeCalculator/createBikeFirst";
import { createBikeLast } from "./routeCalculator/createBikeLast";
import {
  findNearestStation,
  getTotalTime,
  removeDuplicates,
  sortCandidates,
  addNamesToSummary,
} from "./routeCalculator/helpers";

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

  return finalRoutes.slice(0, 5);
}

async function calculateWaypointRoutes({ start, end, viaPoints, stations }) {
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

  if (stations?.length) {
    const startStation = findNearestStation(start, stations);
    const viaStation = findNearestStation(viaPoint, stations);
    const endStation = findNearestStation(end, stations);
    const bikeTimeSec = 900;

    const startToViaRoutes = [];
    const viaToEndRoutes = [];

    if (
      startStation &&
      viaStation &&
      startStation.stationId !== viaStation.stationId
    ) {
      try {
        const forward = await fetchTimedBikeSegments(
          startStation,
          viaStation,
          stations,
          bikeTimeSec
        );
        if (forward?.segment1 && forward?.transferStation) {
          const route = await createBikeFirst({
            start,
            end: viaPoint,
            startStation,
            transferStation: forward.transferStation,
            segment1: forward.segment1,
            bikeTimeSec,
          });
          if (route) startToViaRoutes.push(route);
        }
      } catch (error) {
        console.error("경유 경로(출발→경유) bike-first 생성 실패:", error);
      }

      try {
        const backward = await fetchTimedBikeSegments(
          viaStation,
          startStation,
          stations,
          bikeTimeSec
        );
        if (backward?.segment1 && backward?.transferStation) {
          const route = await createBikeLast({
            start,
            end: viaPoint,
            endStation: viaStation,
            transferStation: backward.transferStation,
            segment1: backward.segment1,
            bikeTimeSec,
          });
          if (route) startToViaRoutes.push(route);
        }
      } catch (error) {
        console.error("경유 경로(출발→경유) bike-last 생성 실패:", error);
      }
    }

    if (
      viaStation &&
      endStation &&
      viaStation.stationId !== endStation.stationId
    ) {
      try {
        const forward = await fetchTimedBikeSegments(
          viaStation,
          endStation,
          stations,
          bikeTimeSec
        );
        if (forward?.segment1 && forward?.transferStation) {
          const route = await createBikeFirst({
            start: viaPoint,
            end,
            startStation: viaStation,
            transferStation: forward.transferStation,
            segment1: forward.segment1,
            bikeTimeSec,
          });
          if (route) viaToEndRoutes.push(route);
        }
      } catch (error) {
        console.error("경유 경로(경유→도착) bike-first 생성 실패:", error);
      }

      try {
        const backward = await fetchTimedBikeSegments(
          endStation,
          viaStation,
          stations,
          bikeTimeSec
        );
        if (backward?.segment1 && backward?.transferStation) {
          const route = await createBikeLast({
            start: viaPoint,
            end,
            endStation,
            transferStation: backward.transferStation,
            segment1: backward.segment1,
            bikeTimeSec,
          });
          if (route) viaToEndRoutes.push(route);
        }
      } catch (error) {
        console.error("경유 경로(경유→도착) bike-last 생성 실패:", error);
      }
    }

    for (const leg1 of startToViaRoutes) {
      for (const leg2 of viaToEndRoutes) {
        const summary = {
          info: {
            totalTime: getTotalTime(leg1.summary) + getTotalTime(leg2.summary),
          },
          subPath: [
            ...(leg1.summary?.subPath || []),
            ...(leg2.summary?.subPath || []),
          ],
        };
        addNamesToSummary(summary, start, end);
        candidates.push({
          segments: [...leg1.segments, ...leg2.segments],
          summary,
        });
      }
    }
  }

  return sortCandidates(removeDuplicates(candidates));
}

async function calculateDirectRoutes({ start, end, stations }) {
  let allCandidates = [];
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
        const r1 = await createBikeFirst({
          start,
          end,
          startStation,
          transferStation: forward.transferStation,
          segment1: forward.segment1,
          bikeTimeSec,
        });
        if (r1) currentCandidates.push(r1);

        const backward = await fetchTimedBikeSegments(
          endStation,
          startStation,
          stations,
          bikeTimeSec
        );
        const r2 = await createBikeLast({
          start,
          end,
          endStation,
          transferStation: backward.transferStation,
          segment1: backward.segment1,
          bikeTimeSec,
        });
        if (r2) currentCandidates.push(r2);
      } catch (e) {
        console.error(`자전거 경로 생성 실패 (시간: ${bikeTimeSec}s):`, e);
      }
    }

    allCandidates.push(...currentCandidates);
    if (sortCandidates(removeDuplicates(allCandidates)).length >= 5) break;
  }
  return sortCandidates(removeDuplicates(allCandidates));
}

