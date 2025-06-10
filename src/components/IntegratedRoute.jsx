// src/components/IntegratedRoute.jsx
import React, { useEffect, useState } from "react";
import { fetchOdsayRoute } from "../utils/fetchOdsayRoute";
import { fetchTimedBikeSegments } from "../utils/splitBikeRoute";
import polyline from "polyline";
import RouteLine from "./RouteLine";
import haversine from "../utils/haversine";
import { ROUTE_COLORS, getColorByTrafficType } from "../utils/routeColors";

// ODsay 경로를 분석하여 지도에 그릴 세그먼트 배열로 변환하는 함수
function parseOdsayPathToSegments(data) {
  const subPaths = data?.result?.path?.[0]?.subPath || [];
  if (!subPaths.length) return [];

  return subPaths.map(sp => {
    let coords = [];
    const color = getColorByTrafficType(sp.trafficType);
    let type = 'walk';

    if (sp.trafficType === 1) { // 지하철
      type = 'subway';
      if (sp.passStopList?.stations) {
        coords = sp.passStopList.stations.map(s => new naver.maps.LatLng(+s.y, +s.x));
      }
    } else if (sp.trafficType === 2) { // 버스
      type = 'bus';
      if (sp.passStopList?.stations) {
        coords = sp.passStopList.stations.map(s => new naver.maps.LatLng(+s.y, +s.x));
      }
    } else { // 도보
      type = 'walk';
      if (sp.polyline?.length) {
        coords = polyline.decode(sp.polyline, 5).map(([lat, lng]) => new naver.maps.LatLng(lat, lng));
      }
    }
    if (coords.length === 0 && sp.startY && sp.startX && sp.endY && sp.endX) {
      coords = [new naver.maps.LatLng(+sp.startY, +sp.startX), new naver.maps.LatLng(+sp.endY, +sp.endX)];
    }
    return { ...sp, type, color, coords };
  }).filter(segment => segment.coords.length > 0);
}

// ORS API로 도보 경로를 가져오는 함수
async function fetchFootCoords(from, to) {
    const key = import.meta.env.VITE_ORS_API_KEY;
    try {
        const res = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/json", {
            method: "POST",
            headers: { Authorization: key, "Content-Type": "application/json" },
            body: JSON.stringify({ coordinates: [from, to] }),
        });
        if (!res.ok) return { coords: [], duration: 0 };
        const data = await res.json();
        const route = data.routes?.[0];
        if (!route) return { coords: [], duration: 0 };

        const duration = route.summary.duration;
        const coords = polyline.decode(route.geometry, 5).map(([lat, lng]) => new naver.maps.LatLng(lat, lng));
        return { coords, duration };
    } catch (error) {
        console.error("fetchFootCoords 에러:", error);
        return { coords: [], duration: 0 };
    }
}

// 가장 가까운 대여소를 찾는 함수
function findNearestStation(point, stations, radius = 1000) {
  let best = null, minD = Infinity;
  for (const s of stations) {
    const d = haversine(point.lat, point.lng, +s.stationLatitude, +s.stationLongitude);
    if (d < minD && d <= radius) {
      minD = d;
      best = s;
    }
  }
  return best;
}

export default function IntegratedRoute({
  mapInstance,
  start,
  end,
  stations,
  bikeTimeSec,
  setRouteSummary,
}) {
  const [routeSegments, setRouteSegments] = useState([]);

  useEffect(() => {
    // [복원] 기존 콘솔 로그를 복원합니다.
    console.log("[IntegratedRoute] useEffect 진입", {
      start,
      end,
      stationsCount: stations.length,
      bikeTimeSec,
      mapInstanceReady: !!mapInstance,
    });

    if (!mapInstance || !start || !end) {
      console.log("[IntegratedRoute] 필수 인자 누락 → return");
      return;
    }
    if (bikeTimeSec > 0 && stations.length === 0) {
        console.log("[IntegratedRoute] stations 비어있음 → return");
        return;
    }

    const calculateAndDrawRoute = async () => {
      try {
        // [복원] 기존 콘솔 로그를 복원합니다.
        console.group("[IntegratedRoute] 경로 생성 과정");
        
        let finalSegments = [];
        let summaryData = null;

        if (bikeTimeSec <= 0) {
          console.groupCollapsed("1단계: 전체 경로 (대중교통)");
          const res = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: end.lat, x: end.lng });
          console.log("[IntegratedRoute] → ODsay 전체 응답:", res);

          if (res && !res.error && res.result.path.length > 0) {
            finalSegments = parseOdsayPathToSegments(res);
            summaryData = res.result.path[0];
          } else {
            console.log("[IntegratedRoute] ODsay 실패 → ORS 도보 폴백");
            const foot = await fetchFootCoords([start.lng, start.lat], [end.lng, end.lat]);
            finalSegments.push({ type: 'walk', color: ROUTE_COLORS.WALK, coords: foot.coords });
            summaryData = { info: { totalTime: Math.round(foot.duration / 60) }, subPath: [{ trafficType: 3, sectionTime: Math.round(foot.duration / 60), distance: Math.round(foot.distance) }] };
          }
           console.log(`[IntegratedRoute] 최종 전체 경로 coords 개수: ${finalSegments.flatMap(s => s.coords).length}`);
          console.groupEnd();

        } else {
          console.groupCollapsed("1단계: 출발→대여소");
          const startStation = findNearestStation(start, stations);
          if (!startStation) {
            alert("출발지 1km 내에 따릉이 대여소가 없습니다.");
            console.groupEnd(); console.groupEnd(); return;
          }
          console.log("[IntegratedRoute] • 선택된 출발 대여소:", startStation.stationName);
          const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +startStation.stationLatitude, x: +startStation.stationLongitude });
          const startSubPaths = resStart?.result?.path[0]?.subPath || [];
          console.log("[IntegratedRoute] → ODsay 출발 응답:", resStart);

          console.groupEnd();
          
          console.groupCollapsed("2단계: 자전거");
          const endStation = findNearestStation(end, stations);
          if (!endStation) {
            alert("도착지 1km 내에 따릉이 대여소가 없습니다.");
            console.groupEnd(); console.groupEnd(); return;
          }
          console.log("[IntegratedRoute] • 선택된 도착 대여소:", endStation.stationName);
          const { segment1, transferStation } = await fetchTimedBikeSegments(startStation, endStation, stations, bikeTimeSec);
          const bikeSec = segment1.routes[0].summary.duration;
          const bikeSubPath = {
              trafficType: 4, // 자전거를 위한 커스텀 타입
              laneColor: ROUTE_COLORS.BIKE,
              startName: startStation.stationName.replace(/^\d+\.\s*/, ''),
              endName: transferStation.stationName.replace(/^\d+\.\s*/, ''),
              sectionTime: Math.round(bikeSec / 60),
          };
          console.log("[IntegratedRoute] • 자전거 환승지:", transferStation.stationName);
          console.groupEnd();

          console.groupCollapsed("3단계: 환승→도착");
          const resEnd = await fetchOdsayRoute({ y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }, { y: end.lat, x: end.lng });
          const endSubPaths = resEnd?.result?.path[0]?.subPath || [];
          console.log("[IntegratedRoute] → ODsay 도착 응답:", resEnd);

          const combinedSubPath = [...startSubPaths, bikeSubPath, ...endSubPaths];
          
          const startSegments = resStart.error ? [] : parseOdsayPathToSegments({ result: { path: [resStart.result.path[0]] }});
          const bikePath = polyline.decode(segment1.routes[0].geometry, 5).map(([lat, lng]) => new naver.maps.LatLng(lat, lng));
          const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikePath };
          const endSegments = resEnd.error ? [] : parseOdsayPathToSegments({ result: { path: [resEnd.result.path[0]] }});
          finalSegments = [...startSegments, bikeSegment, ...endSegments];

          const totalTime = (resStart?.result?.path[0]?.info.totalTime || 0) + Math.round(bikeSec / 60) + (resEnd?.result?.path[0]?.info.totalTime || 0);
          const info = { totalTime: totalTime };
          summaryData = { info, subPath: combinedSubPath };
          console.groupEnd();
        }

        setRouteSegments(finalSegments);
        setRouteSummary(summaryData);

        const allCoords = finalSegments.flatMap(s => s.coords);
        // [복원] 기존 디버깅용 window 변수를 복원합니다.
        if (import.meta.env.DEV) window.__coords = allCoords;

        if (allCoords.length > 1) {
            const bounds = allCoords.reduce((b, p) => b.extend(p), new naver.maps.LatLngBounds(allCoords[0], allCoords[0]));
            mapInstance.fitBounds(bounds, 100);
        }
        
        console.groupEnd(); // 경로 생성 과정 groupEnd

      } catch (err) {
        console.error("[IntegratedRoute] 에러:", err);
        setRouteSummary(null);
      }
    };

    calculateAndDrawRoute();
    
    return () => {
      setRouteSegments([]);
      setRouteSummary(null);
    };
  }, [mapInstance, start, end, stations, bikeTimeSec, setRouteSummary]);

  return (
    <>
      {routeSegments.map((segment, index) => (
        <RouteLine
          key={`${segment.type}-${index}`}
          map={mapInstance}
          coords={segment.coords}
          color={segment.color}
        />
      ))}
    </>
  );
}