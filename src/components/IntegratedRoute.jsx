import React, { useEffect, useState } from "react";
import { fetchOdsayRoute } from "../utils/fetchOdsayRoute";
import { fetchTimedBikeSegments } from "../utils/splitBikeRoute";
import { fetchTmapRoute } from "../utils/fetchTmapRoute";
import polyline from "polyline";
import RouteLine from "./RouteLine";
import haversine from "../utils/haversine";
import { ROUTE_COLORS, getColorByTrafficType } from "../utils/routeColors";

/**
 * ODsay 경로 데이터를 분석하여 지도에 표시할 세그먼트 배열로 변환합니다.
 * @param {object} odsayPath - ODsay API 응답의 path 객체
 * @param {object} overallStart - 전체 경로의 출발지 객체 {lat, lng}
 * @param {object} overallEnd - 전체 경로의 도착지 객체 {lat, lng}
 * @returns {Promise<Array>} 지도에 그릴 경로 세그먼트 배열
 */
async function processOdsayPath(odsayPath, overallStart, overallEnd) {
    const subPaths = odsayPath?.subPath || [];
    if (!subPaths.length) return [];

    const processedSegments = [];

    for (let i = 0; i < subPaths.length; i++) {
        const sp = subPaths[i];
        let coords = [];
        let type = '';
        const color = getColorByTrafficType(sp.trafficType);

        if (sp.trafficType === 1 || sp.trafficType === 2) { // 지하철 또는 버스
            type = sp.trafficType === 1 ? 'subway' : 'bus';
            if (sp.passStopList?.stations) {
                coords = sp.passStopList.stations.map(s => new window.naver.maps.LatLng(+s.y, +s.x));
            }
        } else if (sp.trafficType === 3) { // 도보
            type = 'walk';
            let startPoint, endPoint;

            if (i === 0) { // 첫 번째 구간이 도보
                startPoint = overallStart;
                const nextPath = subPaths[i + 1];
                if (nextPath?.passStopList?.stations?.length > 0) {
                   endPoint = { lat: +nextPath.passStopList.stations[0].y, lng: +nextPath.passStopList.stations[0].x };
                } else {
                   endPoint = overallEnd; // 다음 경로가 없으면 최종 도착지까지 도보
                }
            } else if (i === subPaths.length - 1) { // 마지막 구간이 도보
                const prevPath = subPaths[i - 1];
                if (prevPath?.passStopList?.stations?.length > 0) {
                    const lastStation = prevPath.passStopList.stations[prevPath.passStopList.stations.length - 1];
                    startPoint = { lat: +lastStation.y, lng: +lastStation.x };
                }
                endPoint = overallEnd;
            } else { // 중간 환승 도보
                const prevPath = subPaths[i - 1];
                const nextPath = subPaths[i + 1];
                if (prevPath?.passStopList?.stations?.length > 0 && nextPath?.passStopList?.stations?.length > 0) {
                    const lastStation = prevPath.passStopList.stations[prevPath.passStopList.stations.length - 1];
                    const firstStation = nextPath.passStopList.stations[0];
                    startPoint = { lat: +lastStation.y, lng: +lastStation.x };
                    endPoint = { lat: +firstStation.y, lng: +firstStation.x };
                }
            }

            if (startPoint && endPoint) {
                coords = await fetchTmapRoute(startPoint, endPoint);
            }
        }

        if (coords.length > 0) {
            // --- 경로 이어붙이기 (Stitching) 로직 ---
            // 이전에 처리된 경로 조각이 있다면, 현재 조각의 시작점을 이전 조각의 끝점과 일치시킵니다.
            if (processedSegments.length > 0) {
                const prevSegment = processedSegments[processedSegments.length - 1];
                if (prevSegment.coords.length > 0) {
                    const stitchPoint = prevSegment.coords[prevSegment.coords.length - 1];
                    coords.unshift(stitchPoint); // 현재 경로의 맨 앞에 이전 경로의 마지막 점을 추가
                }
            }
            // ------------------------------------

            processedSegments.push({ ...sp, type, color, coords });
        }
    }
    return processedSegments;
}

// 나머지 코드는 이전과 동일합니다.
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
        console.log("[IntegratedRoute] useEffect 진입", { start, end, stationsCount: stations.length, bikeTimeSec, mapInstanceReady: !!mapInstance });
        if (!mapInstance || !start || !end) {
            console.log("[IntegratedRoute] 필수 인자 누락 → return");
            return;
        }
        if (bikeTimeSec > 0 && stations.length === 0) {
            console.log("[IntegratedRoute] 자전거 경로 모드지만, stations 정보 없음 → return");
            return;
        }
        const calculateAndDrawRoute = async () => {
            try {
                console.group("[IntegratedRoute] 경로 생성 과정");
                let finalSegments = [];
                let summaryData = null;
                if (bikeTimeSec <= 0) {
                    console.groupCollapsed("1단계: 전체 경로 (대중교통)");
                    const res = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: end.lat, x: end.lng });
                    console.log("[IntegratedRoute] → ODsay 전체 응답:", res);
                    if (res && !res.error && res.result.path.length > 0) {
                        finalSegments = await processOdsayPath(res.result.path[0], start, end);
                        summaryData = res.result.path[0];
                    } else {
                        console.log("[IntegratedRoute] ODsay 실패 → TMAP 도보 폴백");
                        const footCoords = await fetchTmapRoute(start, end);
                        finalSegments.push({ trafficType: 3, type: 'walk', color: ROUTE_COLORS.WALK, coords: footCoords });
                        summaryData = null; 
                    }
                    console.log(`[IntegratedRoute] 최종 전체 경로 coords 개수: ${finalSegments.flatMap(s => s.coords).length}`);
                    console.groupEnd();
                } else {
                    console.groupCollapsed("1단계: 출발→대여소");
                    const startStation = findNearestStation(start, stations);
                    if (!startStation) { alert("출발지 1km 내에 따릉이 대여소가 없습니다."); console.groupEnd(); console.groupEnd(); return; }
                    const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +startStation.stationLatitude, x: +startStation.stationLongitude });
                    const startSubPaths = resStart?.result?.path[0]?.subPath || [];
                    const startSegments = resStart.error ? [] : await processOdsayPath(resStart.result.path[0], start, {lat: +startStation.stationLatitude, lng: +startStation.stationLongitude});
                    console.groupEnd();
                    console.groupCollapsed("2단계: 자전거");
                    const endStation = findNearestStation(end, stations);
                    if (!endStation) { alert("도착지 1km 내에 따릉이 대여소가 없습니다."); console.groupEnd(); console.groupEnd(); return; }
                    const { segment1, transferStation } = await fetchTimedBikeSegments(startStation, endStation, stations, bikeTimeSec);
                    const bikeSec = segment1.routes[0].summary.duration;
                    const bikeSubPath = { trafficType: 4, laneColor: ROUTE_COLORS.BIKE, startName: startStation.stationName.replace(/^\d+\.\s*/, ''), endName: transferStation.stationName.replace(/^\d+\.\s*/, ''), sectionTime: Math.round(bikeSec / 60) };
                    const bikePath = polyline.decode(segment1.routes[0].geometry, 5).map(([lat, lng]) => new naver.maps.LatLng(lat, lng));
                    const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikePath };
                    console.groupEnd();
                    console.groupCollapsed("3단계: 환승→도착");
                    const resEnd = await fetchOdsayRoute({ y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }, { y: end.lat, x: end.lng });
                    const endSubPaths = resEnd?.result?.path[0]?.subPath || [];
                    const endSegments = resEnd.error ? [] : await processOdsayPath(resEnd.result.path[0], {lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude}, end);
                    console.groupEnd();
                    const combinedSubPath = [...startSubPaths, bikeSubPath, ...endSubPaths];
                    finalSegments = [...startSegments, bikeSegment, ...endSegments];
                    summaryData = { info: { totalTime: (resStart?.result?.path[0]?.info.totalTime || 0) + Math.round(bikeSec / 60) + (resEnd?.result?.path[0]?.info.totalTime || 0) }, subPath: combinedSubPath };
                }
                setRouteSegments(finalSegments);
                setRouteSummary(summaryData);
                const allCoords = finalSegments.flatMap(s => s.coords);
                if (import.meta.env.DEV) window.__coords = allCoords;
                if (allCoords.length > 1) {
                    const bounds = allCoords.reduce((b, p) => b.extend(p), new naver.maps.LatLngBounds(allCoords[0], allCoords[0]));
                    mapInstance.fitBounds(bounds, 100);
                }
                console.groupEnd();
            } catch (err) {
                console.error("[IntegratedRoute] 경로 생성 중 에러 발생:", err);
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