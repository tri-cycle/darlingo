// src/utils/routeCalculator/createBikeFirst.js

import { fetchOdsayRoute } from "../fetchOdsayRoute";
import polyline from "polyline";
import { ROUTE_COLORS } from "../routeColors";
import { processOdsayPath } from "./processOdsayPath";
import { getTotalTime, addNamesToSummary } from "./helpers";
import haversine from "../haversine";

const DEFAULT_PATH_LIMIT = 3;

function cloneSubPath(subPath = []) {
  return subPath.map(path => ({ ...path }));
}

/**
 * 자전거를 먼저 이용한 후 대중교통으로 환승하는 경로를 생성한다.
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
    if (!startStation || !transferStation || !segment1?.routes?.[0]?.summary) {
      console.warn("⚠️ createBikeFirst: 필수 파라미터 누락");
      return [];
    }

    // 1. 출발지 → 시작 대여소 경로
    const resStart = await fetchOdsayRoute(
      { y: start.lat, x: start.lng },
      { y: +startStation.stationLatitude, x: +startStation.stationLongitude }
    );

    // 2. 환승 대여소 → 도착지 경로
    const resEnd = await fetchOdsayRoute(
      { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude },
      { y: end.lat, x: end.lng }
    );

    console.log("📍 createBikeFirst ODsay 응답:", {
      시작경로: resStart?.result?.path?.length || 0,
      종료경로: resEnd?.result?.path?.length || 0
    });

    let startPaths = (resStart?.result?.path || []).slice(pathIndex, pathIndex + maxPaths);
    let endPaths = (resEnd?.result?.path || []).slice(pathIndex, pathIndex + maxPaths);

    // 📍 ODsay 경로가 없으면 직접 도보 경로 생성
    if (!startPaths.length) {
      console.warn("⚠️ createBikeFirst: 출발지→대여소 경로 없음 → 도보 경로 직접 생성");
      const walkDistance = Math.round(
        haversine(start.lat, start.lng, +startStation.stationLatitude, +startStation.stationLongitude)
      );
      const walkTime = Math.max(1, Math.round(walkDistance / 67)); // 4km/h = 67m/min
      startPaths = [{
        info: { totalTime: walkTime },
        subPath: [{
          trafficType: 3,
          sectionTime: walkTime,
          distance: walkDistance,
        }]
      }];
    }

    if (!endPaths.length) {
      console.warn("⚠️ createBikeFirst: 환승대여소→도착지 경로 없음 → 도보 경로 직접 생성");
      const walkDistance = Math.round(
        haversine(+transferStation.stationLatitude, +transferStation.stationLongitude, end.lat, end.lng)
      );
      const walkTime = Math.max(1, Math.round(walkDistance / 67));
      endPaths = [{
        info: { totalTime: walkTime },
        subPath: [{
          trafficType: 3,
          sectionTime: walkTime,
          distance: walkDistance,
        }]
      }];
    }

    // 3. ODsay 경로 처리
    const processedStartPaths = [];
    for (const startPath of startPaths) {
      const startSegments = await processOdsayPath(
        startPath,
        start,
        { lat: +startStation.stationLatitude, lng: +startStation.stationLongitude }
      );
      
      // 📍 도보만 있는 짧은 경로는 직선으로 처리
      if (startSegments === null && startPath.subPath?.[0]?.trafficType === 3) {
        console.warn("⚠️ createBikeFirst: 시작 경로 → 직선 도보로 대체");
        const walkCoords = [
          new window.naver.maps.LatLng(start.lat, start.lng),
          new window.naver.maps.LatLng(+startStation.stationLatitude, +startStation.stationLongitude)
        ];
        processedStartPaths.push({ 
          path: startPath, 
          segments: [{ ...startPath.subPath[0], type: "walk", color: ROUTE_COLORS.WALK, coords: walkCoords }]
        });
        continue;
      }
      
      if (startSegments === null) {
        console.warn("⚠️ createBikeFirst: 시작 경로 처리 실패");
        continue;
      }
      processedStartPaths.push({ path: startPath, segments: startSegments });
    }

    const processedEndPaths = [];
    for (const endPath of endPaths) {
      const endSegments = await processOdsayPath(
        endPath,
        { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude },
        end
      );
      
      // 📍 도보만 있는 짧은 경로는 직선으로 처리
      if (endSegments === null && endPath.subPath?.[0]?.trafficType === 3) {
        console.warn("⚠️ createBikeFirst: 종료 경로 → 직선 도보로 대체");
        const walkCoords = [
          new window.naver.maps.LatLng(+transferStation.stationLatitude, +transferStation.stationLongitude),
          new window.naver.maps.LatLng(end.lat, end.lng)
        ];
        processedEndPaths.push({ 
          path: endPath, 
          segments: [{ ...endPath.subPath[0], type: "walk", color: ROUTE_COLORS.WALK, coords: walkCoords }]
        });
        continue;
      }
      
      if (endSegments === null) {
        console.warn("⚠️ createBikeFirst: 종료 경로 처리 실패");
        continue;
      }
      processedEndPaths.push({ path: endPath, segments: endSegments });
    }

    if (!processedStartPaths.length || !processedEndPaths.length) {
      console.warn("⚠️ createBikeFirst: 처리된 경로 없음");
      return [];
    }

    // 4. 자전거 구간 생성
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

    // 5. 경로 결합
    const candidates = [];

    for (const { path: startPath, segments: startSegments } of processedStartPaths) {
      for (const { path: endPath, segments: endSegments } of processedEndPaths) {
        const combinedSubPath = [
          ...cloneSubPath(startPath.subPath || []),
          { ...bikeSubPath },
          ...cloneSubPath(endPath.subPath || []),
        ];

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

    console.log(`✅ createBikeFirst: ${candidates.length}개 경로 생성 완료`);
    return candidates;
  } catch (error) {
    console.error("❌ createBikeFirst 실패:", error);
    return [];
  }
}