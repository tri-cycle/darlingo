// src/components/IntegratedRoute.jsx

import React, { useEffect } from "react";
import { fetchOdsayRoute } from "../utils/fetchOdsayRoute";
import { fetchTimedBikeSegments } from "../utils/splitBikeRoute";
import { fetchTmapRoute } from "../utils/fetchTmapRoute";
import polyline from "polyline";
import RouteLine from "./RouteLine";
import haversine from "../utils/haversine";
import { ROUTE_COLORS, getColorByTrafficType } from "../utils/routeColors";

/**
 * ODsay API 응답 데이터를 분석하여 지도에 그릴 수 있는 경로 세그먼트 배열로 가공합니다.
 * @param {object} odsayPath - ODsay API 응답의 path 객체
 * @param {object} overallStart - 전체 경로의 실제 출발지 객체 {lat, lng}
 * @param {object} overallEnd - 전체 경로의 실제 도착지 객체 {lat, lng}
 * @returns {Promise<Array>} 지도에 그릴 경로 세그먼트 객체들의 배열
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
        if (sp.trafficType === 1 || sp.trafficType === 2) {
            type = sp.trafficType === 1 ? 'subway' : 'bus';
            if (sp.passStopList?.stations) {
                coords = sp.passStopList.stations.map(s => new window.naver.maps.LatLng(+s.y, +s.x));
            }
        } else if (sp.trafficType === 3) {
            type = 'walk';
            let startPoint, endPoint;
            if (i === 0) {
                startPoint = overallStart;
                const nextPath = subPaths[i + 1];
                if (nextPath?.passStopList?.stations?.length > 0) {
                   endPoint = { lat: +nextPath.passStopList.stations[0].y, lng: +nextPath.passStopList.stations[0].x };
                } else {
                   endPoint = overallEnd;
                }
            } else if (i === subPaths.length - 1) {
                const prevPath = subPaths[i - 1];
                if (prevPath?.passStopList?.stations?.length > 0) {
                    const lastStation = prevPath.passStopList.stations[prevPath.passStopList.stations.length - 1];
                    startPoint = { lat: +lastStation.y, lng: +lastStation.x };
                }
                endPoint = overallEnd;
            } else {
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
            if (processedSegments.length > 0) {
                const prevSegment = processedSegments[processedSegments.length - 1];
                if (prevSegment.coords.length > 0) {
                    const stitchPoint = prevSegment.coords[prevSegment.coords.length - 1];
                    coords.unshift(stitchPoint);
                }
            }
            processedSegments.push({ ...sp, type, color, coords });
        }
    }
    return processedSegments;
}

/**
 * 주어진 지점에서 반경(기본 1km) 내의 가장 가까운 따릉이 대여소를 찾습니다.
 * @param {object} point - 기준점 좌표 {lat, lng}
 * @param {Array} stations - 전체 대여소 목록
 * @returns {object | null} 가장 가까운 대여소 객체 또는 null
 */
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
    routes,
    selectedIndex,
    setRoutes,
}) {

    useEffect(() => {
        if (!mapInstance || !start || !end) return;
        if (bikeTimeSec > 0 && stations.length === 0) return;

        function addNames(summary) {
            if (summary && summary.subPath && summary.subPath.length > 0) {
                if (summary.subPath[0].trafficType === 3) {
                    summary.subPath[0].startName = start.name;
                    const firstBike = summary.subPath.find(p => p.trafficType === 4);
                    if (firstBike) summary.subPath[0].endName = firstBike.startName;
                }
                const lastIndex = summary.subPath.length - 1;
                if (summary.subPath[lastIndex].trafficType === 3) {
                    summary.subPath[lastIndex].endName = end.name;
                }
            }
        }

        const calculateRoutes = async () => {
            const results = [];

            // ---------- 대중교통만 이용 ----------
            if (bikeTimeSec <= 0) {
                const res = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: end.lat, x: end.lng });
                let segments = [];
                let summary = null;
                if (res && !res.error && res.result.path.length > 0) {
                    segments = await processOdsayPath(res.result.path[0], start, end);
                    summary = res.result.path[0];
                } else {
                    const footCoords = await fetchTmapRoute(start, end);
                    segments.push({ trafficType: 3, type: 'walk', color: ROUTE_COLORS.WALK, coords: footCoords });
                }
                if (summary) addNames(summary);
                results.push({ segments, summary });
            } else {
                // ---------- bike-first ----------
                const r1 = await createBikeFirst();
                if (r1) results.push(r1);

                // ---------- bike-last ----------
                const r2 = await createBikeLast();
                if (r2) results.push(r2);
            }

            setRoutes(results);
        };

        // ----- 전략별 계산 함수들 -----
        async function createBikeFirst() {
            const startStation = findNearestStation(start, stations);
            const endStation = findNearestStation(end, stations);
            if (!startStation || !endStation) return null;

            const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +startStation.stationLatitude, x: +startStation.stationLongitude });
            let startSubPaths = resStart?.result?.path[0]?.subPath || [];
            let startSegments = [];
            if (startSubPaths.length === 0) {
                const manualWalkCoords = await fetchTmapRoute(start, { lat: +startStation.stationLatitude, lng: +startStation.stationLongitude });
                const distance = Math.round(haversine(start.lat, start.lng, +startStation.stationLatitude, +startStation.stationLongitude));
                const sectionTime = Math.max(1, Math.round(distance / 80));
                const manualWalkSubPath = { trafficType: 3, distance, sectionTime };
                const manualWalkSegment = { ...manualWalkSubPath, type: 'walk', color: ROUTE_COLORS.WALK, coords: manualWalkCoords };
                startSubPaths = [manualWalkSubPath];
                startSegments = [manualWalkSegment];
            } else {
                startSegments = resStart.error ? [] : await processOdsayPath(resStart.result.path[0], start, { lat: +startStation.stationLatitude, lng: +startStation.stationLongitude });
            }

            const { segment1, transferStation } = await fetchTimedBikeSegments(startStation, endStation, stations, bikeTimeSec);
            const bikeSec = segment1.routes[0].summary.duration;
            const bikeSubPath = { trafficType: 4, laneColor: ROUTE_COLORS.BIKE, startName: startStation.stationName.replace(/^\d+\.\s*/, ''), endName: transferStation.stationName.replace(/^\d+\.\s*/, ''), sectionTime: Math.round(bikeSec / 60) };
            const bikePath = polyline.decode(segment1.routes[0].geometry, 5).map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
            const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikePath };

            const resEnd = await fetchOdsayRoute({ y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }, { y: end.lat, x: end.lng });
            let endSubPaths = resEnd?.result?.path[0]?.subPath || [];
            let endSegments = [];
            if (endSubPaths.length === 0) {
                const manualWalkCoords = await fetchTmapRoute({ lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude }, end);
                const distance = Math.round(haversine(+transferStation.stationLatitude, +transferStation.stationLongitude, end.lat, end.lng));
                const sectionTime = Math.max(1, Math.round(distance / 80));
                const manualWalkSubPath = { trafficType: 3, distance, sectionTime };
                const manualWalkSegment = { ...manualWalkSubPath, type: 'walk', color: ROUTE_COLORS.WALK, coords: manualWalkCoords };
                endSubPaths = [manualWalkSubPath];
                endSegments = [manualWalkSegment];
            } else {
                endSegments = resEnd.error ? [] : await processOdsayPath(resEnd.result.path[0], { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude }, end);
            }

            const combinedSubPath = [...startSubPaths, bikeSubPath, ...endSubPaths];
            const segments = [...startSegments, bikeSegment, ...endSegments];
            const summary = { info: { totalTime: (resStart?.result?.path[0]?.info.totalTime || startSubPaths[0]?.sectionTime || 0) + Math.round(bikeSec / 60) + (resEnd?.result?.path[0]?.info.totalTime || 0) }, subPath: combinedSubPath };
            addNames(summary);
            return { segments, summary };
        }

        async function createBikeLast() {
            const startStation = findNearestStation(start, stations);
            const endStation = findNearestStation(end, stations);
            if (!startStation || !endStation) return null;
            const { segment2, transferStation } = await fetchTimedBikeSegments(startStation, endStation, stations, bikeTimeSec);

            const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude });
            let startSubPaths = resStart?.result?.path[0]?.subPath || [];
            let startSegments = [];
            if (startSubPaths.length === 0) {
                const manualWalkCoords = await fetchTmapRoute(start, { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude });
                const distance = Math.round(haversine(start.lat, start.lng, +transferStation.stationLatitude, +transferStation.stationLongitude));
                const sectionTime = Math.max(1, Math.round(distance / 80));
                const manualWalkSubPath = { trafficType: 3, distance, sectionTime };
                const manualWalkSegment = { ...manualWalkSubPath, type: 'walk', color: ROUTE_COLORS.WALK, coords: manualWalkCoords };
                startSubPaths = [manualWalkSubPath];
                startSegments = [manualWalkSegment];
            } else {
                startSegments = resStart.error ? [] : await processOdsayPath(resStart.result.path[0], start, { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude });
            }

            const bikeSec = segment2.routes[0].summary.duration;
            const bikeSubPath = { trafficType: 4, laneColor: ROUTE_COLORS.BIKE, startName: transferStation.stationName.replace(/^\d+\.\s*/, ''), endName: endStation.stationName.replace(/^\d+\.\s*/, ''), sectionTime: Math.round(bikeSec / 60) };
            const bikePath = polyline.decode(segment2.routes[0].geometry, 5).map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
            const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikePath };

            const resEnd = await fetchOdsayRoute({ y: +endStation.stationLatitude, x: +endStation.stationLongitude }, { y: end.lat, x: end.lng });
            let endSubPaths = resEnd?.result?.path[0]?.subPath || [];
            let endSegments = [];
            if (endSubPaths.length === 0) {
                const manualWalkCoords = await fetchTmapRoute({ lat: +endStation.stationLatitude, lng: +endStation.stationLongitude }, end);
                const distance = Math.round(haversine(+endStation.stationLatitude, +endStation.stationLongitude, end.lat, end.lng));
                const sectionTime = Math.max(1, Math.round(distance / 80));
                const manualWalkSubPath = { trafficType: 3, distance, sectionTime };
                const manualWalkSegment = { ...manualWalkSubPath, type: 'walk', color: ROUTE_COLORS.WALK, coords: manualWalkCoords };
                endSubPaths = [manualWalkSubPath];
                endSegments = [manualWalkSegment];
            } else {
                endSegments = resEnd.error ? [] : await processOdsayPath(resEnd.result.path[0], { lat: +endStation.stationLatitude, lng: +endStation.stationLongitude }, end);
            }

            const combinedSubPath = [...startSubPaths, bikeSubPath, ...endSubPaths];
            const segments = [...startSegments, bikeSegment, ...endSegments];
            const summary = { info: { totalTime: (resStart?.result?.path[0]?.info.totalTime || startSubPaths[0]?.sectionTime || 0) + Math.round(bikeSec / 60) + (resEnd?.result?.path[0]?.info.totalTime || 0) }, subPath: combinedSubPath };
            addNames(summary);
            return { segments, summary };
        }

        calculateRoutes();
    }, [mapInstance, start, end, stations, bikeTimeSec, setRoutes]);

    const currentSegments = routes[selectedIndex]?.segments || [];

    return (
        <>
            {currentSegments.map((segment, index) => (
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