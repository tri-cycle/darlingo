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

const MAX_PUBLIC_TRANSIT_PATHS = 2; // ✨ 3 → 2로 감소

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

async function calculateWaypointRoutes({ start, end, viaPoints, stations }) {
  const candidates = [];
  const viaPoint = viaPoints[0];

  console.log("🚀 경유지 경로 계산 시작:", { 
    start: start.name, 
    via: viaPoint.name, 
    end: end.name 
  });

  // 1️⃣ 순수 대중교통 경로 (기존 로직)
  try {
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
    console.log(`✅ 순수 대중교통 경로: ${candidates.length}개 생성`);
  } catch (e) {
    console.error("❌ 대중교통 경로 조회 실패:", e);
  }

  // 2️⃣ 순수 자전거 경로 (기존 로직)
  try {
    const bikeData = await fetchBikeRoute([start, viaPoint, end].map(p => [p.lng, p.lat]));
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
      console.log(`✅ 순수 자전거 경로: 1개 생성`);
    }
  } catch (e) {
    console.error("❌ 전체 자전거 경로 조회 실패:", e);
  }

  // ✨ 3️⃣ 자전거+대중교통 복합 경로 추가
  try {
    const startStation = findNearestStation(start, stations);
    const viaStation = findNearestStation(viaPoint, stations);
    const endStation = findNearestStation(end, stations);

    console.log("🚲 경유지용 가장 가까운 대여소:", {
      시작: startStation?.stationName,
      경유지: viaStation?.stationName,
      종료: endStation?.stationName
    });

    if (startStation && viaStation && endStation) {
      // ✨ 구간1: 출발지 → 경유지 (자전거 포함)
      const bikeTimesSeconds = [900, 1200, 1800]; // 15, 20, 30분
      
      for (const bikeTimeSec of bikeTimesSeconds) {
        // A. 출발→경유지: 자전거 먼저
        try {
          const segment1 = await fetchTimedBikeSegments(
            startStation,
            viaStation,
            stations,
            bikeTimeSec
          );

          if (segment1?.segment1 && segment1?.transferStation) {
            const bikeCandidates1 = await createBikeFirst({
              start,
              end: viaPoint,
              startStation,
              transferStation: segment1.transferStation,
              segment1: segment1.segment1,
              bikeTimeSec,
              maxPaths: 1, // 경유지는 1개만
            });

            // B. 경유지→도착지: 대중교통만
            const resViaToEnd = await fetchOdsayRoute(
              { y: viaPoint.lat, x: viaPoint.lng },
              { y: end.lat, x: end.lng }
            );

            const pathsViaToEnd = (resViaToEnd?.result?.path || []).slice(0, 1);
            
            for (const candidate1 of bikeCandidates1) {
              for (const p2 of pathsViaToEnd) {
                const seg2 = await processOdsayPath(p2, viaPoint, end);
                if (seg2 === null) continue;

                const summary = {
                  info: {
                    totalTime: candidate1.summary.info.totalTime + getTotalTime(p2),
                  },
                  subPath: [
                    ...(candidate1.summary.subPath || []),
                    ...(p2.subPath || []),
                  ],
                };
                addNamesToSummary(summary, start, end);
                candidates.push({
                  segments: [...candidate1.segments, ...seg2],
                  summary,
                });
              }
            }
          }
        } catch (e) {
          console.error(`❌ 출발→경유지 자전거 경로 실패 (${bikeTimeSec}s):`, e);
        }

        // C. 출발→경유지: 대중교통만 + 경유지→도착지: 자전거
        try {
          const segment2 = await fetchTimedBikeSegments(
            viaStation,
            endStation,
            stations,
            bikeTimeSec
          );

          if (segment2?.segment1 && segment2?.transferStation) {
            const bikeCandidates2 = await createBikeFirst({
              start: viaPoint,
              end,
              startStation: viaStation,
              transferStation: segment2.transferStation,
              segment1: segment2.segment1,
              bikeTimeSec,
              maxPaths: 1, // 경유지는 1개만
            });

            const resStartToVia = await fetchOdsayRoute(
              { y: start.lat, x: start.lng },
              { y: viaPoint.lat, x: viaPoint.lng }
            );

            const pathsStartToVia = (resStartToVia?.result?.path || []).slice(0, 1);
            
            for (const p1 of pathsStartToVia) {
              const seg1 = await processOdsayPath(p1, start, viaPoint);
              if (seg1 === null) continue;

              for (const candidate2 of bikeCandidates2) {
                const summary = {
                  info: {
                    totalTime: getTotalTime(p1) + candidate2.summary.info.totalTime,
                  },
                  subPath: [
                    ...(p1.subPath || []),
                    ...(candidate2.summary.subPath || []),
                  ],
                };
                addNamesToSummary(summary, start, end);
                candidates.push({
                  segments: [...seg1, ...candidate2.segments],
                  summary,
                });
              }
            }
          }
        } catch (e) {
          console.error(`❌ 경유지→도착지 자전거 경로 실패 (${bikeTimeSec}s):`, e);
        }
      }

      console.log(`✅ 복합 경로(경유지): ${candidates.length - (candidates.filter(c => c.summary.subPath.every(p => p.trafficType !== 4)).length)}개 생성`);
    }
  } catch (e) {
    console.error("❌ 경유지 복합 경로 생성 실패:", e);
  }

  const sorted = sortCandidates(removeDuplicates(candidates));
  const prioritized = prioritizeRoutes(sorted);
  
  console.log("\n✨ 경유지 최종 결과:", {
    전체: prioritized.length,
    복합: prioritized.filter(r => {
      const sp = r?.summary?.subPath || [];
      return sp.some(p => p?.trafficType === 4) && sp.some(p => p?.trafficType !== 4);
    }).length
  });

  return prioritized;
}

async function calculateDirectRoutes({ start, end, stations }) {
  let allCandidates = [];

  console.log("🚀 경로 계산 시작:", { start: start.name, end: end.name });

  // 1️⃣ 순수 대중교통 경로 추가 (최대 2개로 제한)
  try {
    const res = await fetchOdsayRoute(
      { y: start.lat, x: start.lng },
      { y: end.lat, x: end.lng }
    );
    
    console.log("📍 ODsay 순수 대중교통 경로:", res?.result?.path?.length || 0, "개");
    
    if (res?.result?.path) {
      // ✨ 최대 2개만 처리
      for (const p of res.result.path.slice(0, 2)) {
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

  // ✨ 최적화: 4개 시간대만 사용 (15, 20, 30, 40분)
  const bikeTimesSeconds = [
    900,   // 15분
    1200,  // 20분
    1800,  // 30분
    2400,  // 40분
  ];

  // ✨ 병렬 처리를 위한 Promise 배열
  const forwardPromises = [];
  const backwardPromises = [];

  for (let attempt = 0; attempt < bikeTimesSeconds.length; attempt++) {
    const bikeTimeSec = bikeTimesSeconds[attempt];
    
    console.log(`\n🔄 시도 ${attempt + 1}/${bikeTimesSeconds.length} (자전거 시간: ${bikeTimeSec / 60}분)`);

    // ✨ Forward와 Backward를 동시에 요청
    forwardPromises.push(
      fetchTimedBikeSegments(startStation, endStation, stations, bikeTimeSec)
        .then(forward => ({ forward, bikeTimeSec, direction: 'forward' }))
        .catch(e => {
          console.error(`❌ Forward 자전거 구간 생성 실패 (${bikeTimeSec}s):`, e);
          return null;
        })
    );

    backwardPromises.push(
      fetchTimedBikeSegments(endStation, startStation, stations, bikeTimeSec)
        .then(backward => ({ backward, bikeTimeSec, direction: 'backward' }))
        .catch(e => {
          console.error(`❌ Backward 자전거 구간 생성 실패 (${bikeTimeSec}s):`, e);
          return null;
        })
    );
  }

  // ✨ 모든 자전거 경로를 병렬로 한번에 처리
  const [forwardResults, backwardResults] = await Promise.all([
    Promise.all(forwardPromises),
    Promise.all(backwardPromises)
  ]);

  // Forward 경로 처리
  for (const result of forwardResults) {
    if (!result || !result.forward?.segment1 || !result.forward?.transferStation) continue;
    
    const { forward, bikeTimeSec } = result;
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
  }

  // Backward 경로 처리
  for (const result of backwardResults) {
    if (!result || !result.backward?.segment1 || !result.backward?.transferStation) continue;
    
    const { backward, bikeTimeSec } = result;
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
  }

  // ✨ 최종 정렬 및 다양성 확보
  const finalSorted = sortCandidates(removeDuplicates(allCandidates));
  const diverseRoutes = ensureBikeTimeDiversity(finalSorted);
  const prioritized = prioritizeRoutes(diverseRoutes);
  
  console.log("\n✨ 최종 결과:", {
    전체: prioritized.length,
    복합: prioritized.filter(r => {
      const sp = r?.summary?.subPath || [];
      return sp.some(p => p?.trafficType === 4) && sp.some(p => p?.trafficType !== 4);
    }).length
  });

  return prioritized;
}

// ✨ 자전거 시간대별 다양성을 확보하는 함수
function ensureBikeTimeDiversity(routes) {
  const getBikeTime = (route) => {
    return route?.summary?.subPath?.reduce((sum, path) => 
      path?.trafficType === 4 ? sum + (path.sectionTime || 0) : sum, 0) || 0;
  };

  // 자전거 시간대별로 그룹화 (5분 단위)
  const timeGroups = new Map();
  
  for (const route of routes) {
    const bikeTime = getBikeTime(route);
    const timeGroup = Math.floor(bikeTime / 5) * 5; // 5분 단위로 그룹화
    
    if (!timeGroups.has(timeGroup)) {
      timeGroups.set(timeGroup, []);
    }
    timeGroups.get(timeGroup).push(route);
  }

  // 각 시간대별로 최대 2개씩 선택
  const diverseRoutes = [];
  const sortedGroups = Array.from(timeGroups.entries()).sort((a, b) => a[0] - b[0]);
  
  for (const [timeGroup, groupRoutes] of sortedGroups) {
    // 각 그룹에서 총 시간이 짧은 순으로 최대 2개 선택
    const sorted = groupRoutes.sort((a, b) => 
      getTotalTime(a.summary) - getTotalTime(b.summary)
    );
    diverseRoutes.push(...sorted.slice(0, 2));
  }

  console.log("🎯 시간대별 경로 분포:", 
    Array.from(timeGroups.entries()).map(([time, routes]) => 
      `${time}분대: ${routes.length}개`
    ).join(", ")
  );

  return diverseRoutes.slice(0, 10); // 최대 10개 경로 반환
}