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
    console.error("❌ 경로 계산 중 오류 발생:", error);
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
    console.error("❌ 전체 자전거 경로 조회 실패:", e);
  }

  return sortCandidates(removeDuplicates(candidates));
}

async function calculateDirectRoutes({ start, end, stations }) {
  let allCandidates = [];
  let mixedRouteCount = 0;
  const MAX_ATTEMPTS = 3;

  console.log("🚀 경로 계산 시작:", { start: start.name, end: end.name });

  // 1️⃣ 먼저 순수 대중교통 경로 추가
  try {
    const res = await fetchOdsayRoute(
      { y: start.lat, x: start.lng },
      { y: end.lat, x: end.lng }
    );
    
    console.log("📍 ODsay 순수 대중교통 경로:", res?.result?.path?.length || 0, "개");
    
    if (res?.result?.path) {
      for (const p of res.result.path.slice(0, 3)) {
        const segments = await processOdsayPath(p, start, end);
        if (segments === null) continue;
        addNamesToSummary(p, start, end);
        allCandidates.push({ segments, summary: p });
      }
    }
  } catch (e) {
    console.error("❌ 순수 대중교통 경로 조회 실패:", e);
  }

  // 2️⃣ 자전거+대중교통 결합 경로 생성
  const startStation = findNearestStation(start, stations);
  const endStation = findNearestStation(end, stations);

  console.log("🚲 가장 가까운 대여소:", {
    시작: startStation?.stationName,
    종료: endStation?.stationName
  });

  if (!startStation || !endStation) {
    console.warn("⚠️ 근처에 대여소를 찾을 수 없습니다");
    return sortCandidates(removeDuplicates(allCandidates));
  }

  if (startStation.stationId === endStation.stationId) {
    console.warn("⚠️ 시작/종료 대여소가 동일합니다");
    return sortCandidates(removeDuplicates(allCandidates));
  }

  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    const bikeTimeSec = 900 + attempt * 900;
    
    console.log(`\n🔄 시도 ${attempt + 1}/${MAX_ATTEMPTS + 1} (자전거 시간: ${bikeTimeSec / 60}분)`);

    try {
      // Forward: 출발→자전거→대중교통→도착
      const forward = await fetchTimedBikeSegments(
        startStation,
        endStation,
        stations,
        bikeTimeSec
      );

      if (forward?.segment1 && forward?.transferStation) {
        console.log("✅ Forward 자전거 구간 생성 성공:", forward.transferStation.stationName);
        
        const candidatesForward = await createBikeFirst({
          start,
          end,
          startStation,
          transferStation: forward.transferStation,
          segment1: forward.segment1,
          bikeTimeSec,
          maxPaths: MAX_PUBLIC_TRANSIT_PATHS,
        });
        
        console.log(`  → ${candidatesForward.length}개 Forward 경로 생성`);
        allCandidates.push(...candidatesForward);
      } else {
        console.warn("⚠️ Forward 자전거 구간 생성 실패");
      }

      // Backward: 출발→대중교통→자전거→도착
      const backward = await fetchTimedBikeSegments(
        endStation,
        startStation,
        stations,
        bikeTimeSec
      );

      if (backward?.segment1 && backward?.transferStation) {
        console.log("✅ Backward 자전거 구간 생성 성공:", backward.transferStation.stationName);
        
        const candidatesBackward = await createBikeLast({
          start,
          end,
          endStation,
          transferStation: backward.transferStation,
          segment1: backward.segment1,
          bikeTimeSec,
          maxPaths: MAX_PUBLIC_TRANSIT_PATHS,
        });
        
        console.log(`  → ${candidatesBackward.length}개 Backward 경로 생성`);
        allCandidates.push(...candidatesBackward);
      } else {
        console.warn("⚠️ Backward 자전거 구간 생성 실패");
      }
    } catch (e) {
      console.error(`❌ 자전거 경로 생성 실패 (시간: ${bikeTimeSec}s):`, e);
    }

    const sortedCandidates = sortCandidates(removeDuplicates(allCandidates));
    allCandidates = sortedCandidates;

    mixedRouteCount = sortedCandidates.reduce((count, candidate) => {
      const subPaths = candidate?.summary?.subPath || [];
      const hasBike = subPaths.some(path => path?.trafficType === 4);
      const hasNonBike = subPaths.some(path => path?.trafficType !== 4);
      return hasBike && hasNonBike ? count + 1 : count;
    }, 0);

    console.log(`📊 현재 복합 경로: ${mixedRouteCount}개 / 전체: ${sortedCandidates.length}개`);

    if (mixedRouteCount >= 5 || attempt >= MAX_ATTEMPTS) break;
  }

  const finalSorted = sortCandidates(removeDuplicates(allCandidates));
  const prioritized = prioritizeRoutes(finalSorted);
  
  console.log("\n✨ 최종 결과:", {
    전체: prioritized.length,
    복합: prioritized.filter(r => {
      const sp = r?.summary?.subPath || [];
      return sp.some(p => p?.trafficType === 4) && sp.some(p => p?.trafficType !== 4);
    }).length
  });

  return prioritized;
}