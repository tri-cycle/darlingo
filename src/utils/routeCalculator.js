// src/utils/routeCalculator.js

import { fetchOdsayRoute } from "./fetchOdsayRoute";
import { fetchTimedBikeSegments } from "./splitBikeRoute";
import { fetchTmapRoute } from "./fetchTmapRoute";
import { fetchBikeRoute } from "./fetchBikeRoute";
import polyline from "polyline";
import haversine from "./haversine";
import { ROUTE_COLORS, getColorByTrafficType } from "./routeColors";

// --- Helper Functions (유틸리티 함수) ---

async function processOdsayPath(odsayPath, overallStart, overallEnd) {
    const subPaths = odsayPath?.subPath || [];
    if (!subPaths.length) return [];
    const processedSegments = [];
    for (let i = 0; i < subPaths.length; i++) {
        const sp = subPaths[i];
        let coords = [];
        const color = getColorByTrafficType(sp.trafficType);
        if (sp.trafficType === 1 || sp.trafficType === 2) {
            if (sp.passStopList?.stations) {
                coords = sp.passStopList.stations.map(s => new window.naver.maps.LatLng(+s.y, +s.x));
            }
        } else if (sp.trafficType === 3) {
            let startPoint, endPoint;
            const prevPath = subPaths[i - 1];
            const nextPath = subPaths[i + 1];
            if (i === 0) startPoint = overallStart;
            else if (prevPath?.passStopList?.stations?.length > 0) startPoint = { lat: +prevPath.passStopList.stations.slice(-1)[0].y, lng: +prevPath.passStopList.stations.slice(-1)[0].x };
            if (i === subPaths.length - 1) endPoint = overallEnd;
            else if (nextPath?.passStopList?.stations?.length > 0) endPoint = { lat: +nextPath.passStopList.stations[0].y, lng: +nextPath.passStopList.stations[0].x };
            if (startPoint && endPoint) coords = await fetchTmapRoute(startPoint, endPoint);
        }
        if (coords.length > 0) {
            const prevSegment = processedSegments[processedSegments.length - 1];
            if (prevSegment?.coords.length > 0) coords.unshift(prevSegment.coords.slice(-1)[0]);
            processedSegments.push({ ...sp, type: sp.trafficType === 1 ? 'subway' : (sp.trafficType === 2 ? 'bus' : 'walk'), color, coords });
        }
    }
    return processedSegments;
}

function findNearestStation(point, stations) {
    let best = null, minD = Infinity;
    for (const s of stations) {
        const d = haversine(point.lat, point.lng, +s.stationLatitude, +s.stationLongitude);
        if (d < minD) { minD = d; best = s; }
    }
    return best;
}

function getTotalTime(path) {
    return path?.info?.totalTime ?? (path?.subPath || []).reduce((sum, sp) => sum + (sp.sectionTime || 0), 0);
}

function removeDuplicates(list) {
    const unique = [];
    const seen = new Set();
    for (const r of list) {
        const key = r.summary ? JSON.stringify(r.summary) : JSON.stringify(r.segments);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(r);
    }
    return unique;
}

function sortCandidates(candidates) {
    return candidates.sort((a, b) => getTotalTime(a.summary) - getTotalTime(b.summary));
}

function addNamesToSummary(summary, overallStart, overallEnd) {
    if (!summary?.subPath?.length) return;
    const subPath = summary.subPath;
    if (subPath[0].trafficType === 3) {
        subPath[0].startName = overallStart.name;
        const nextTransit = subPath.find(p => p.trafficType !== 3);
        if (nextTransit) subPath[0].endName = nextTransit.startName;
    }
    const lastSegment = subPath[subPath.length - 1];
    if (lastSegment.trafficType === 3) {
        lastSegment.endName = overallEnd.name;
        const prevTransit = subPath.slice(0, -1).reverse().find(p => p.trafficType !== 3);
        if (prevTransit) lastSegment.startName = prevTransit.endName;
    }
}

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

async function calculateWaypointRoutes({ start, end, viaPoints }) {
    const candidates = [];
    const viaPoint = viaPoints[0];

    const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: viaPoint.lat, x: viaPoint.lng });
    const resEnd = await fetchOdsayRoute({ y: viaPoint.lat, x: viaPoint.lng }, { y: end.lat, x: end.lng });
    const pathsStart = (resStart?.result?.path || []).slice(0, 2);
    const pathsEnd = (resEnd?.result?.path || []).slice(0, 2);

    for (const p1 of pathsStart) {
        for (const p2 of pathsEnd) {
            const seg1 = await processOdsayPath(p1, start, viaPoint);
            const seg2 = await processOdsayPath(p2, viaPoint, end);
            const summary = { info: { totalTime: getTotalTime(p1) + getTotalTime(p2) }, subPath: [...(p1.subPath || []), ...(p2.subPath || [])] };
            addNamesToSummary(summary, start, end);
            candidates.push({ segments: [...seg1, ...seg2], summary });
        }
    }
    
    try {
        const bikeData = await fetchBikeRoute([start, ...viaPoints, end].map(p => [p.lng, p.lat]));
        if (bikeData?.routes?.[0]) {
            const { geometry, summary: { distance, duration } } = bikeData.routes[0];
            const bikeCoords = polyline.decode(geometry, 5).map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
            const sectionTime = Math.round(duration / 60);
            const summaryBike = { info: { totalTime: sectionTime }, subPath: [{ trafficType: 4, laneColor: ROUTE_COLORS.BIKE, startName: start.name, endName: end.name, sectionTime, distance, avgSpeed: (distance / 1000) / (duration / 3600) }] };
            candidates.push({ segments: [{ type: "bike", color: ROUTE_COLORS.BIKE, coords: bikeCoords }], summary: summaryBike });
        }
    } catch(e) { console.error("전체 자전거 경로 조회 실패:", e); }

    return sortCandidates(removeDuplicates(candidates));
}

async function calculateDirectRoutes({ start, end, stations }) {
    let allCandidates = [];
    const MAX_ATTEMPTS = 3; 

    for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
        const bikeTimeSec = 900 + (attempt * 900);
        const currentCandidates = [];

        if (attempt === 0) {
            const res = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: end.lat, x: end.lng });
            if (res?.result?.path) {
                for (const p of res.result.path.slice(0, 5)) {
                    const segments = await processOdsayPath(p, start, end);
                    addNamesToSummary(p, start, end);
                    currentCandidates.push({ segments, summary: p });
                }
            }
        }

        const startStation = findNearestStation(start, stations);
        const endStation = findNearestStation(end, stations);

        if (startStation && endStation && startStation.stationId !== endStation.stationId) {
            try {
                const forward = await fetchTimedBikeSegments(startStation, endStation, stations, bikeTimeSec);
                const r1 = await createBikeFirst({ start, end, startStation, transferStation: forward.transferStation, segment1: forward.segment1, bikeTimeSec });
                if (r1) currentCandidates.push(r1);

                const backward = await fetchTimedBikeSegments(endStation, startStation, stations, bikeTimeSec);
                const r2 = await createBikeLast({ start, end, endStation, transferStation: backward.transferStation, segment1: backward.segment1, bikeTimeSec });
                if (r2) currentCandidates.push(r2);
            } catch(e) {
                console.error(`자전거 경로 생성 실패 (시간: ${bikeTimeSec}s):`, e);
            }
        }
        
        allCandidates.push(...currentCandidates);
        if (sortCandidates(removeDuplicates(allCandidates)).length >= 5) break;
    }
    return sortCandidates(removeDuplicates(allCandidates));
}

async function createBikeFirst({ start, end, startStation, transferStation, segment1, bikeTimeSec, pathIndex = 0 }) {
    if (!startStation || !transferStation || !segment1?.routes?.[0]?.summary) return null;

    const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +startStation.stationLatitude, x: +startStation.stationLongitude });
    const startPath = resStart?.result?.path?.[pathIndex] || { subPath: [] };
    const startSegments = await processOdsayPath(startPath, start, { lat: +startStation.stationLatitude, lng: +startStation.stationLongitude });

    const { distance } = segment1.routes[0].summary;
    const bikeTimeMin = Math.max(1, Math.round(bikeTimeSec / 60));
    const bikeSubPath = { trafficType: 4, laneColor: ROUTE_COLORS.BIKE, startName: startStation.stationName.replace(/^\d+\.\s*/, ''), endName: transferStation.stationName.replace(/^\d+\.\s*/, ''), sectionTime: bikeTimeMin, distance, avgSpeed: 13 };
    const bikeCoords = polyline.decode(segment1.routes[0].geometry, 5).map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
    const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikeCoords };

    const resEnd = await fetchOdsayRoute({ y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }, { y: end.lat, x: end.lng });
    const endPath = resEnd?.result?.path?.[pathIndex] || { subPath: [] };
    const endSegments = await processOdsayPath(endPath, { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude }, end);

    const combinedSubPath = [...(startPath.subPath || []), bikeSubPath, ...(endPath.subPath || [])];
    const summary = { info: { totalTime: getTotalTime(startPath) + bikeTimeMin + getTotalTime(endPath) }, subPath: combinedSubPath };
    addNamesToSummary(summary, start, end);
    return { segments: [...startSegments, bikeSegment, ...endSegments], summary };
}

async function createBikeLast({ start, end, endStation, transferStation, segment1, bikeTimeSec, pathIndex = 0 }) {
    if (!endStation || !transferStation || !segment1?.routes?.[0]?.summary) return null;
    
    const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +transferStation.stationLatitude, x: +transferStation.stationLongitude });
    const startPath = resStart?.result?.path?.[pathIndex] || { subPath: [] };
    const startSegments = await processOdsayPath(startPath, start, { lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude });

    const { distance } = segment1.routes[0].summary;
    const bikeTimeMin = Math.max(1, Math.round(bikeTimeSec / 60));
    const bikeSubPath = { trafficType: 4, laneColor: ROUTE_COLORS.BIKE, startName: transferStation.stationName.replace(/^\d+\.\s*/, ''), endName: endStation.stationName.replace(/^\d+\.\s*/, ''), sectionTime: bikeTimeMin, distance, avgSpeed: 13 };
    const bikeCoords = polyline.decode(segment1.routes[0].geometry, 5).reverse().map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
    const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikeCoords };
    
    const resEnd = await fetchOdsayRoute({ y: +endStation.stationLatitude, x: +endStation.stationLongitude }, { y: end.lat, x: end.lng });
    const endPath = resEnd?.result?.path?.[pathIndex] || { subPath: [] };
    const endSegments = await processOdsayPath(endPath, { lat: +endStation.stationLatitude, lng: +endStation.stationLongitude }, end);

    const summary = { info: { totalTime: getTotalTime(startPath) + bikeTimeMin + getTotalTime(endPath) }, subPath: [...(startPath.subPath || []), bikeSubPath, ...(endPath.subPath || [])] };
    addNamesToSummary(summary, start, end);
    return { segments: [...startSegments, bikeSegment, ...endSegments], summary };
}