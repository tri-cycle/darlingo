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

// 주어진 path 객체의 전체 소요 시간을 계산합니다.
// ODsay API의 info.totalTime이 존재하면 이를 사용하고,
// 그렇지 않으면 subPath의 sectionTime 합계를 반환합니다.
function getTotalTime(path, subPaths) {
    if (path && path.info && typeof path.info.totalTime === 'number') {
        return path.info.totalTime;
    }
    return (subPaths || []).reduce((sum, sp) => sum + (sp.sectionTime || 0), 0);
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

            // ----- 자전거 연계 경로 -----
            if (bikeTimeSec > 0) {
                const startStation = findNearestStation(start, stations);
                const endStation = findNearestStation(end, stations);

                if (startStation && endStation) {
                    const forward = await fetchTimedBikeSegments(
                        startStation,
                        endStation,
                        stations,
                        bikeTimeSec
                    );

                    const r1 = await createBikeFirst(forward.segment1, forward.transferStation);
                    if (r1) results.push(r1);

                    if (results.length < 5) {
                        const backward = await fetchTimedBikeSegments(
                            endStation,
                            startStation,
                            stations,
                            bikeTimeSec
                        );
                        const r2 = await createBikeLast(backward.segment1, backward.transferStation);
                        if (r2) results.push(r2);
                    }

                    let altIndex = 1;
                    while (results.length < 5) {
                        const alt = await createBikeFirst(forward.segment1, forward.transferStation, altIndex);
                        if (!alt) break;
                        results.push(alt);
                        altIndex += 1;
                    }

                    // 중간에 자전거를 타는 경로 추가
                    if (results.length < 5) {
                        const midStations = await findMiddleStations();
                        if (midStations) {
                            const midRoute = await createBikeMiddle(
                                midStations.startStation,
                                midStations.endStation
                            );
                            if (midRoute) results.push(midRoute);
                        }
                    }
                }
            } else {
                // ----- 대중교통 경로 -----
                const res = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: end.lat, x: end.lng });
                if (res && !res.error && res.result.path.length > 0) {
                    const paths = res.result.path.slice(0, 5);
                    for (const p of paths) {
                        const segments = await processOdsayPath(p, start, end);
                        addNames(p);
                        results.push({ segments, summary: p });
                    }
                } else {
                    const footCoords = await fetchTmapRoute(start, end);
                    const segments = [{ trafficType: 3, type: 'walk', color: ROUTE_COLORS.WALK, coords: footCoords }];
                    results.push({ segments, summary: null });
                }
            }

            // 중복 경로 제거 후 상태 업데이트
            const unique = [];
            const seen = new Set();
            for (const r of results) {
                const key = JSON.stringify(r.summary);
                if (seen.has(key)) continue;
                seen.add(key);
                unique.push(r);
            }

            setRoutes(unique);
        };

        // ----- 전략별 계산 함수들 -----
        async function createBikeFirst(segment1, transferStation, pathIndex = 0) {
            const startStation = findNearestStation(start, stations);
            const endStation = findNearestStation(end, stations);
            if (!startStation || !endStation) return null;

            const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +startStation.stationLatitude, x: +startStation.stationLongitude });
            const startPaths = resStart?.result?.path || [];
            const startPath = startPaths[pathIndex] || startPaths[0];
            let startSubPaths = startPath?.subPath || [];
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
                startSegments = resStart.error || !startPath ? [] : await processOdsayPath(startPath, start, { lat: +startStation.stationLatitude, lng: +startStation.stationLongitude });
            }

            console.log("--- 🚴 Bike-First 경로 탐색 시작 ---");
            console.log("➡️ 미리 받아온 값:", {
                startStation: startStation.stationName,
                endStation: endStation.stationName,
                bikeTimeSec: bikeTimeSec,
            });
            
            console.log("📍 API가 반환한 값:", segment1.routes[0].summary);
            
            const bikeDist = segment1.routes[0].summary.distance; 
            const FIXED_BIKE_SPEED_KMPH = 13; // ◀️◀️ 여기를 13으로 수정
            const newBikeSec = (bikeDist / 1000) / FIXED_BIKE_SPEED_KMPH * 3600;

            const bikeSubPath = { 
                trafficType: 4, 
                laneColor: ROUTE_COLORS.BIKE, 
                startName: startStation.stationName.replace(/^\d+\.\s*/, ''), 
                endName: transferStation.stationName.replace(/^\d+\.\s*/, ''), 
                sectionTime: Math.round(newBikeSec / 60),
                distance: bikeDist, 
                avgSpeed: FIXED_BIKE_SPEED_KMPH,
            };
            
            console.log("📈 우리가 계산한 값:", {
                sectionTime: bikeSubPath.sectionTime,
                distance: bikeSubPath.distance,
                avgSpeed: bikeSubPath.avgSpeed
            });
            console.log("------------------------------------");

            const bikePath = polyline.decode(segment1.routes[0].geometry, 5).map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
            const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikePath };

            const resEnd = await fetchOdsayRoute({ y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }, { y: end.lat, x: end.lng });
            const endPaths = resEnd?.result?.path || [];
            const endPath = endPaths[pathIndex] || endPaths[0];
            let endSubPaths = endPath?.subPath || [];
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
                endSegments = resEnd.error || !endPath ? [] : await processOdsayPath(endPath, { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude }, end);
            }

            const combinedSubPath = [...startSubPaths, bikeSubPath, ...endSubPaths];
            const segments = [...startSegments, bikeSegment, ...endSegments];
            const summaryTime = getTotalTime(startPath, startSubPaths) + Math.round(newBikeSec / 60) + getTotalTime(endPath, endSubPaths);
            const summary = { info: { totalTime: summaryTime }, subPath: combinedSubPath };
            addNames(summary);
            return { segments, summary };
        }

        async function createBikeLast(segment1, transferStation, pathIndex = 0) {
            const startStation = findNearestStation(start, stations);
            const endStation = findNearestStation(end, stations);
            if (!startStation || !endStation) return null;

            console.log("--- 🚴 Bike-Last 경로 탐색 시작 ---");
            console.log("➡️ 미리 받아온 값:", {
                startStation: endStation.stationName,
                endStation: startStation.stationName,
                bikeTimeSec: bikeTimeSec,
            });

            const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude });
            const startPaths = resStart?.result?.path || [];
            const startPath = startPaths[pathIndex] || startPaths[0];
            let startSubPaths = startPath?.subPath || [];
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
                startSegments = resStart.error || !startPath ? [] : await processOdsayPath(startPath, start, { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude });
            }
            
            console.log("📍 API가 반환한 값:", segment1.routes[0].summary);
            
            const bikeDist = segment1.routes[0].summary.distance;
            const FIXED_BIKE_SPEED_KMPH = 13; // ◀️◀️ 여기를 13으로 수정
            const newBikeSec = (bikeDist / 1000) / FIXED_BIKE_SPEED_KMPH * 3600;

            const bikeSubPath = { 
                trafficType: 4, 
                laneColor: ROUTE_COLORS.BIKE, 
                startName: transferStation.stationName.replace(/^\d+\.\s*/, ''), 
                endName: endStation.stationName.replace(/^\d+\.\s*/, ''), 
                sectionTime: Math.round(newBikeSec / 60),
                distance: bikeDist,
                avgSpeed: FIXED_BIKE_SPEED_KMPH
            };
            
            console.log("📈 우리가 계산한 값:", {
                sectionTime: bikeSubPath.sectionTime,
                distance: bikeSubPath.distance,
                avgSpeed: bikeSubPath.avgSpeed
            });
            console.log("-----------------------------------");

            const bikePath = polyline
                .decode(segment1.routes[0].geometry, 5)
                .reverse()
                .map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
            const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikePath };

            const resEnd = await fetchOdsayRoute({ y: +endStation.stationLatitude, x: +endStation.stationLongitude }, { y: end.lat, x: end.lng });
            const endPaths = resEnd?.result?.path || [];
            const endPath = endPaths[pathIndex] || endPaths[0];
            let endSubPaths = endPath?.subPath || [];
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
                endSegments = resEnd.error || !endPath ? [] : await processOdsayPath(endPath, { lat: +endStation.stationLatitude, lng: +endStation.stationLongitude }, end);
            }

            const combinedSubPath = [...startSubPaths, bikeSubPath, ...endSubPaths];
            const segments = [...startSegments, bikeSegment, ...endSegments];
            const summaryTime = getTotalTime(startPath, startSubPaths) + Math.round(newBikeSec / 60) + getTotalTime(endPath, endSubPaths);
            const summary = { info: { totalTime: summaryTime }, subPath: combinedSubPath };
            addNames(summary);
            return { segments, summary };
        }

        async function createBikeMiddle(startStation, endStation, pathIndex = 0) {
            if (!startStation || !endStation) return null;

            const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +startStation.stationLatitude, x: +startStation.stationLongitude });
            const startPaths = resStart?.result?.path || [];
            const startPath = startPaths[pathIndex] || startPaths[0];
            let startSubPaths = startPath?.subPath || [];
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
                startSegments = resStart.error || !startPath ? [] : await processOdsayPath(startPath, start, { lat: +startStation.stationLatitude, lng: +startStation.stationLongitude });
            }

            const { segment1, segment2 } = await fetchTimedBikeSegments(startStation, endStation, stations, bikeTimeSec);

            const bikeDist = segment1.routes[0].summary.distance + segment2.routes[0].summary.distance;
            const FIXED_BIKE_SPEED_KMPH = 13;
            const newBikeSec = (bikeDist / 1000) / FIXED_BIKE_SPEED_KMPH * 3600;

            const coords1 = polyline.decode(segment1.routes[0].geometry, 5);
            const coords2 = polyline.decode(segment2.routes[0].geometry, 5);
            const bikePath = [...coords1, ...coords2.slice(1)].map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
            const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikePath };

            const bikeSubPath = {
                trafficType: 4,
                laneColor: ROUTE_COLORS.BIKE,
                startName: startStation.stationName.replace(/^\d+\.\s*/, ''),
                endName: endStation.stationName.replace(/^\d+\.\s*/, ''),
                sectionTime: Math.round(newBikeSec / 60),
                distance: bikeDist,
                avgSpeed: FIXED_BIKE_SPEED_KMPH,
            };

            const resEnd = await fetchOdsayRoute({ y: +endStation.stationLatitude, x: +endStation.stationLongitude }, { y: end.lat, x: end.lng });
            const endPaths = resEnd?.result?.path || [];
            const endPath = endPaths[pathIndex] || endPaths[0];
            let endSubPaths = endPath?.subPath || [];
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
                endSegments = resEnd.error || !endPath ? [] : await processOdsayPath(endPath, { lat: +endStation.stationLatitude, lng: +endStation.stationLongitude }, end);
            }

            const combinedSubPath = [...startSubPaths, bikeSubPath, ...endSubPaths];
            const segments = [...startSegments, bikeSegment, ...endSegments];
            const summaryTime = getTotalTime(startPath, startSubPaths) + Math.round(newBikeSec / 60) + getTotalTime(endPath, endSubPaths);
            const summary = { info: { totalTime: summaryTime }, subPath: combinedSubPath };
            addNames(summary);
            return { segments, summary };
        }

        async function findMiddleStations() {
            const res = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: end.lat, x: end.lng });
            const path = res?.result?.path?.[0];
            if (!path) return null;
            const subPaths = path.subPath || [];
            const total = getTotalTime(path, subPaths);
            const mid = total / 2;
            let acc = 0;
            for (let i = 0; i < subPaths.length; i++) {
                acc += subPaths[i].sectionTime || 0;
                if (acc >= mid) {
                    const prev = subPaths[i];
                    const next = subPaths[i + 1];
                    let prevPoint = start;
                    if (prev?.passStopList?.stations?.length > 0) {
                        const last = prev.passStopList.stations[prev.passStopList.stations.length - 1];
                        prevPoint = { lat: +last.y, lng: +last.x };
                    }
                    let nextPoint = end;
                    if (next?.passStopList?.stations?.length > 0) {
                        const first = next.passStopList.stations[0];
                        nextPoint = { lat: +first.y, lng: +first.x };
                    }
                    const startSt = findNearestStation(prevPoint, stations);
                    const endSt = findNearestStation(nextPoint, stations);
                    if (startSt && endSt) return { startStation: startSt, endStation: endSt };
                    break;
                }
            }
            return null;
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