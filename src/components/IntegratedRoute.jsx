// src/components/IntegratedRoute.jsx

import React, { useEffect, useMemo } from "react";
import { fetchOdsayRoute } from "../utils/fetchOdsayRoute";
import { fetchTimedBikeSegments } from "../utils/splitBikeRoute";
import { fetchTmapRoute } from "../utils/fetchTmapRoute";
import { fetchBikeRoute } from "../utils/fetchBikeRoute";
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

// 🚶‍♀️ 전체 도보 시간 계산
function calcWalkTime(summary) {
    if (!summary || !summary.subPath) return Infinity;
    return summary.subPath.reduce(
        (acc, sp) => (sp.trafficType === 3 ? acc + (sp.sectionTime || 0) : acc),
        0
    );
}

// 🚲 따릉이 이용 시간 계산
function calcBikeTime(summary) {
    if (!summary || !summary.subPath) return Infinity;
    return summary.subPath.reduce(
        (acc, sp) => (sp.trafficType === 4 ? acc + (sp.sectionTime || 0) : acc),
        0
    );
}

// 중복 경로 제거
function removeDuplicates(list) {
    const unique = [];
    const seen = new Set();
    for (const r of list) {
        const key = JSON.stringify(r.summary);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(r);
    }
    return unique;
}

// 기존 정렬 전략 재사용 + 자전거 시간 제한 필터링
function sortCandidates(list, bikeLimitSec = Infinity, hasWaypoints = false) {
    // 경유지가 있는 경우 자전거 시간이 제한을 초과해도 필터링하지 않는다.
    // 경유지 분배 시 소수점 및 경로 계산 오차로 인해
    // 실제 자전거 시간이 약간 초과될 수 있으므로 여유를 둔다.
    const filtered = hasWaypoints
        ? list
        : list.filter((r) => calcBikeTime(r.summary) * 60 <= bikeLimitSec + 120);
    return filtered.sort((a, b) => {
        const aWalk = calcWalkTime(a.summary);
        const bWalk = calcWalkTime(b.summary);
        if (aWalk >= 60 && bWalk >= 60) {
            const aBike = calcBikeTime(a.summary);
            const bBike = calcBikeTime(b.summary);
            return aBike - bBike;
        }
        if (aWalk >= 60) return 1;
        if (bWalk >= 60) return -1;
        const aBike = calcBikeTime(a.summary);
        const bBike = calcBikeTime(b.summary);
        if (aBike !== bBike) return aBike - bBike;
        return aWalk - bWalk;
    });
}


export default function IntegratedRoute({
    mapInstance,
    start,
    end,
    waypoints = [],
    stations,
    bikeTimeSec,
    routes,
    selectedIndex,
    setRoutes,
    setIsCalculating,
}) {
    const waypointsKey = useMemo(() => JSON.stringify(waypoints), [waypoints]);
    const stationsKey = useMemo(() => JSON.stringify(stations), [stations]);

    useEffect(() => {
        if (!mapInstance || !start || !end) return;
        if (bikeTimeSec > 0 && stations.length === 0) {
            setIsCalculating(false);
            return;
        }

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

        const viaPoints = waypoints.filter(Boolean);
        if (viaPoints.length > 0) {
            (async () => {
                try {
                    const viaPoint = viaPoints[0];
                    const resStart = await fetchOdsayRoute(
                        { y: start.lat, x: start.lng },
                        { y: viaPoint.lat, x: viaPoint.lng }
                    );
                    const resEnd = await fetchOdsayRoute(
                        { y: viaPoint.lat, x: viaPoint.lng },
                        { y: end.lat, x: end.lng }
                    );
                    const pathsStart = resStart?.result?.path || [];
                    const pathsEnd = resEnd?.result?.path || [];
                    const topStart = pathsStart.slice(0, 3);
                    const topEnd = pathsEnd.slice(0, 3);

                    const candidates = [];

                    // 🚲 전체 자전거 경로 후보 추가
                    try {
                        const bikeCoordsArr = [start, ...viaPoints, end].map((p) => [p.lng, p.lat]);
                        const bikeData = await fetchBikeRoute(bikeCoordsArr);
                        const bikeCoords = polyline
                            .decode(bikeData.routes[0].geometry, 5)
                            .map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
                        const { distance, duration } = bikeData.routes[0].summary;
                        const sectionTime = Math.round(duration / 60);
                        const avgSpeed = (distance / 1000) / (duration / 3600);
                        const bikeSegment = {
                            type: "bike",
                            color: ROUTE_COLORS.BIKE,
                            coords: bikeCoords,
                        };
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
                                    avgSpeed,
                                },
                            ],
                        };
                        candidates.push({ segments: [bikeSegment], summary: summaryBike });
                    } catch (e) {
                        console.error(e);
                    }

                    for (const p1 of topStart) {
                        for (const p2 of topEnd) {
                            const seg1 = await processOdsayPath(p1, start, viaPoint);
                            const seg2 = await processOdsayPath(p2, viaPoint, end);
                            const summary = {
                                info: {
                                    totalTime:
                                        getTotalTime(p1, p1.subPath) +
                                        getTotalTime(p2, p2.subPath),
                                },
                                subPath: [...(p1.subPath || []), ...(p2.subPath || [])],
                            };
                            addNames(summary);
                            candidates.push({
                                segments: [...seg1, ...seg2],
                                summary,
                            });
                        }
                    }

                    if (bikeTimeSec > 0 && stations.length > 0) {
                        // 📌 경유지 기준으로 전체 자전거 시간을 구간별로 분배
                        const pointsForBike = [start, ...viaPoints, end];
                        const stationPairs = [];
                        let totalDist = 0;
                        for (let i = 0; i < pointsForBike.length - 1; i++) {
                            const from = pointsForBike[i];
                            const to = pointsForBike[i + 1];
                            const sStation = findNearestStation(from, stations);
                            const eStation = findNearestStation(to, stations);
                            if (!sStation || !eStation) continue;
                            if (sStation.stationId === eStation.stationId) continue;
                            const dist = haversine(
                                +sStation.stationLatitude,
                                +sStation.stationLongitude,
                                +eStation.stationLatitude,
                                +eStation.stationLongitude
                            );
                            stationPairs.push({ startStation: sStation, endStation: eStation, dist });
                            totalDist += dist;
                        }

                        const bikeSegments = [];
                        const subPathBike = [];
                        let bikeTimeTotal = 0;
                        let remainingTime = bikeTimeSec;
                        for (let i = 0; i < stationPairs.length; i++) {
                            const { startStation, endStation, dist } = stationPairs[i];
                            if (startStation.stationId === endStation.stationId) continue;
                            let alloc = Math.round((dist / totalDist) * bikeTimeSec);
                            if (i === stationPairs.length - 1) alloc = remainingTime;
                            remainingTime -= alloc;
                            const { segment1, segment2 } = await fetchTimedBikeSegments(
                                startStation,
                                endStation,
                                stations,
                                alloc
                            );
                            const coords1 = polyline.decode(segment1.routes[0].geometry, 5);
                            const coords2 = polyline.decode(segment2.routes[0].geometry, 5);
                            const bikePath = [...coords1, ...coords2.slice(1)].map(
                                ([lat, lng]) => new window.naver.maps.LatLng(lat, lng)
                            );
                            bikeSegments.push({ type: "bike", color: ROUTE_COLORS.BIKE, coords: bikePath });
                            const segDist =
                                segment1.routes[0].summary.distance + segment2.routes[0].summary.distance;
                            const FIXED_BIKE_SPEED_KMPH = 13;
                            // ORS 거리 기반 시간을 사용하지 않고 할당된 시간을 그대로 사용
                            const segTimeSec = alloc;
                            bikeTimeTotal += segTimeSec;
                            subPathBike.push({
                                trafficType: 4,
                                laneColor: ROUTE_COLORS.BIKE,
                                startName: startStation.stationName.replace(/^\d+\.\s*/, ""),
                                endName: endStation.stationName.replace(/^\d+\.\s*/, ""),
                                sectionTime: Math.max(1, Math.round(segTimeSec / 60)),
                                distance: segDist,
                                avgSpeed: FIXED_BIKE_SPEED_KMPH,
                            });
                        }
                        if (bikeSegments.length > 0) {
                            if (bikeTimeTotal > bikeTimeSec) {
                                const scale = bikeTimeSec / bikeTimeTotal;
                                bikeTimeTotal = bikeTimeSec;
                                subPathBike.forEach((sp) => {
                                    sp.sectionTime = Math.max(1, Math.round(sp.sectionTime * scale));
                                });
                            }
                            const summaryBike = {
                                info: {
                                    totalTime: Math.max(
                                        Math.round(bikeTimeTotal / 60),
                                        Math.round(bikeTimeSec / 60)
                                    ),
                                },
                                subPath: subPathBike,
                            };
                            candidates.push({ segments: bikeSegments, summary: summaryBike });
                        }

                        const startStation = findNearestStation(start, stations);
                        const endStation = findNearestStation(end, stations);

                        if (
                            startStation &&
                            endStation &&
                            startStation.stationId !== endStation.stationId
                        ) {
                            const forward = await fetchTimedBikeSegments(
                                startStation,
                                endStation,
                                stations,
                                bikeTimeSec
                            );

                            const r1 = await createBikeFirst(
                                forward.segment1,
                                forward.transferStation,
                                0,
                                viaPoints
                            );
                            if (r1) candidates.push(r1);

                            if (candidates.length < 5) {
                                const backward = await fetchTimedBikeSegments(
                                    endStation,
                                    startStation,
                                    stations,
                                    bikeTimeSec
                                );
                                const r2 = await createBikeLast(
                                    backward.segment1,
                                    backward.transferStation,
                                    0,
                                    viaPoints
                                );
                                if (r2) candidates.push(r2);
                            }

                            let altIndex = 1;
                            while (candidates.length < 5) {
                                const alt = await createBikeFirst(
                                    forward.segment1,
                                    forward.transferStation,
                                    altIndex,
                                    viaPoints
                                );
                                if (!alt) break;
                                candidates.push(alt);
                                altIndex += 1;
                            }

                            if (candidates.length < 5) {
                                const midStations = await findMiddleStations(viaPoints);
                                if (midStations) {
                                    const midRoute = await createBikeMiddle(
                                        midStations.startStation,
                                        midStations.endStation,
                                        0,
                                        viaPoints
                                    );
                                    if (midRoute) candidates.push(midRoute);
                                }
                            }
                        }
                    }

                    const unique = removeDuplicates(candidates);
                    const sorted = sortCandidates(unique, bikeTimeSec, true);
                    setRoutes(sorted.slice(0, 5));
                } catch (err) {
                    console.error(err);
                } finally {
                    setIsCalculating(false);
                }
            })();
            return;
        }

        const calculateRoutes = async () => {
            let timeSec = bikeTimeSec;
            let sorted = [];

            while (sorted.length < 5) {
                const results = [];

                // ----- 자전거 연계 경로 -----
                if (timeSec > 0) {
                    const startStation = findNearestStation(start, stations);
                    const endStation = findNearestStation(end, stations);

                    if (
                        startStation &&
                        endStation &&
                        startStation.stationId !== endStation.stationId
                    ) {
                        const forward = await fetchTimedBikeSegments(
                            startStation,
                            endStation,
                            stations,
                            timeSec
                        );

                        const r1 = await createBikeFirst(forward.segment1, forward.transferStation);
                        if (r1) results.push(r1);

                        if (results.length < 5) {
                            const backward = await fetchTimedBikeSegments(
                                endStation,
                                startStation,
                                stations,
                                timeSec
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
                        const paths = res.result.path.slice(0, 10);
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

                const unique = removeDuplicates(results);
                sorted = sortCandidates(unique, bikeTimeSec);

                if (sorted.length < 5) {
                    timeSec += 900;
                } else {
                    break;
                }
            }

            setRoutes(sorted.slice(0, Math.max(5, sorted.length)));
        };

        // ----- 전략별 계산 함수들 -----
        async function createBikeFirst(segment1, transferStation, pathIndex = 0, vias = []) {
            const startStation = findNearestStation(start, stations);
            const endStation = findNearestStation(end, stations);
            if (
                !startStation ||
                !endStation ||
                startStation.stationId === endStation.stationId
            )
                return null;

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
            // ORS 거리 기반 시간 대신 사용자가 지정한 시간을 사용
            const bikeTimeMin = Math.max(1, Math.round(bikeTimeSec / 60));

            const bikeSubPath = {
                trafficType: 4,
                laneColor: ROUTE_COLORS.BIKE,
                startName: startStation.stationName.replace(/^\d+\.\s*/, ''),
                endName: transferStation.stationName.replace(/^\d+\.\s*/, ''),
                sectionTime: bikeTimeMin,
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

            const viaCoord = vias[0] ? { x: vias[0].lng, y: vias[0].lat } : null;
            const resEnd = await fetchOdsayRoute({ y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }, { y: end.lat, x: end.lng }, viaCoord);
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
            const summaryTime =
                getTotalTime(startPath, startSubPaths) +
                bikeTimeMin +
                getTotalTime(endPath, endSubPaths);
            const summary = { info: { totalTime: summaryTime }, subPath: combinedSubPath };
            addNames(summary);
            return { segments, summary };
        }

        async function createBikeLast(segment1, transferStation, pathIndex = 0, vias = []) {
            const startStation = findNearestStation(start, stations);
            const endStation = findNearestStation(end, stations);
            if (
                !startStation ||
                !endStation ||
                startStation.stationId === endStation.stationId
            )
                return null;

            console.log("--- 🚴 Bike-Last 경로 탐색 시작 ---");
            console.log("➡️ 미리 받아온 값:", {
                startStation: endStation.stationName,
                endStation: startStation.stationName,
                bikeTimeSec: bikeTimeSec,
            });

            const viaCoord = vias[0] ? { x: vias[0].lng, y: vias[0].lat } : null;
            const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }, viaCoord);
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
            // ORS 거리 기반 시간 대신 사용자가 지정한 시간을 사용
            const bikeTimeMin = Math.max(1, Math.round(bikeTimeSec / 60));

            const bikeSubPath = {
                trafficType: 4,
                laneColor: ROUTE_COLORS.BIKE,
                startName: transferStation.stationName.replace(/^\d+\.\s*/, ''),
                endName: endStation.stationName.replace(/^\d+\.\s*/, ''),
                sectionTime: bikeTimeMin,
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
            const summaryTime =
                getTotalTime(startPath, startSubPaths) +
                bikeTimeMin +
                getTotalTime(endPath, endSubPaths);
            const summary = { info: { totalTime: summaryTime }, subPath: combinedSubPath };
            addNames(summary);
            return { segments, summary };
        }

        async function createBikeMiddle(startStation, endStation, pathIndex = 0, vias = []) {
            if (
                !startStation ||
                !endStation ||
                startStation.stationId === endStation.stationId
            )
                return null;

            const viaCoord = vias[0] ? { x: vias[0].lng, y: vias[0].lat } : null;
            const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +startStation.stationLatitude, x: +startStation.stationLongitude }, viaCoord);
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
            // ORS 거리 기반 시간 대신 사용자가 지정한 시간을 사용
            const bikeTimeMin = Math.max(1, Math.round(bikeTimeSec / 60));

            const coords1 = polyline.decode(segment1.routes[0].geometry, 5);
            const coords2 = polyline.decode(segment2.routes[0].geometry, 5);
            const bikePath = [...coords1, ...coords2.slice(1)].map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
            const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikePath };

            const bikeSubPath = {
                trafficType: 4,
                laneColor: ROUTE_COLORS.BIKE,
                startName: startStation.stationName.replace(/^\d+\.\s*/, ''),
                endName: endStation.stationName.replace(/^\d+\.\s*/, ''),
                sectionTime: bikeTimeMin,
                distance: bikeDist,
                avgSpeed: FIXED_BIKE_SPEED_KMPH,
            };

            const resEnd = await fetchOdsayRoute({ y: +endStation.stationLatitude, x: +endStation.stationLongitude }, { y: end.lat, x: end.lng }, viaCoord);
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
            const summaryTime =
                getTotalTime(startPath, startSubPaths) +
                bikeTimeMin +
                getTotalTime(endPath, endSubPaths);
            const summary = { info: { totalTime: summaryTime }, subPath: combinedSubPath };
            addNames(summary);
            return { segments, summary };
        }

        async function findMiddleStations(vias = []) {
            const viaCoord = vias[0] ? { x: vias[0].lng, y: vias[0].lat } : null;
            const res = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: end.lat, x: end.lng }, viaCoord);
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
                    if (
                        startSt &&
                        endSt &&
                        startSt.stationId !== endSt.stationId
                    )
                        return { startStation: startSt, endStation: endSt };
                    break;
                }
            }
            return null;
        }

        (async () => {
            try {
                await calculateRoutes();
            } catch (error) {
                console.error(error);
            } finally {
                setIsCalculating(false);
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapInstance, start, end, waypointsKey, stationsKey, bikeTimeSec]);

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