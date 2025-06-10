// src/components/IntegratedRoute.jsx

import React, { useEffect, useState } from "react";
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

                // Case 1: 자전거를 이용하지 않는 경우
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
                } 
                // Case 2: 자전거를 이용하는 경우
                else {
                    console.groupCollapsed("1단계: 출발→대여소");
                    const startStation = findNearestStation(start, stations);
                    if (!startStation) { alert("출발지 1km 내에 따릉이 대여소가 없습니다."); console.groupEnd(); console.groupEnd(); return; }
                    
                    const resStart = await fetchOdsayRoute({ y: start.lat, x: start.lng }, { y: +startStation.stationLatitude, x: +startStation.stationLongitude });
                    let startSubPaths = resStart?.result?.path[0]?.subPath || [];
                    let startSegments = [];

                    // 💡 만약 ODsay가 거리가 너무 짧아 도보 경로를 반환하지 않았다면 (startSubPaths가 비어있다면)
                    if (startSubPaths.length === 0) {
                        console.log("[IntegratedRoute] ODsay가 초기 도보 경로를 반환하지 않았습니다. TMAP으로 수동 생성합니다.");
                        // 1. TMAP API로 직접 도보 경로의 좌표(coords)를 가져옵니다.
                        const manualWalkCoords = await fetchTmapRoute(start, { lat: +startStation.stationLatitude, lng: +startStation.stationLongitude });
                        // 2. haversine으로 직선 거리를 계산합니다.
                        const distance = Math.round(haversine(start.lat, start.lng, +startStation.stationLatitude, +startStation.stationLongitude));
                        // 3. 거리를 기반으로 도보 시간을 추정합니다 (평균 80m/분). 0분이 나오더라도 최소 1분으로 표시합니다.
                        const sectionTime = Math.max(1, Math.round(distance / 80));

                        // 4. 경로 요약(subPath)과 지도 표시(segments)에 사용될 객체를 직접 만들어줍니다.
                        const manualWalkSubPath = {
                            trafficType: 3, // 도보
                            distance: distance,
                            sectionTime: sectionTime,
                        };
                        const manualWalkSegment = {
                            ...manualWalkSubPath,
                            type: 'walk',
                            color: ROUTE_COLORS.WALK,
                            coords: manualWalkCoords
                        };

                        // 5. 직접 만든 경로 조각을 각 배열에 추가합니다.
                        startSubPaths = [manualWalkSubPath];
                        startSegments = [manualWalkSegment];

                    } else {
                        // 기존처럼 ODsay가 경로를 잘 주었다면, processOdsayPath를 통해 경로를 처리합니다.
                        startSegments = resStart.error ? [] : await processOdsayPath(resStart.result.path[0], start, {lat: +startStation.stationLatitude, lng: +startStation.stationLongitude});
                    }
                    console.groupEnd();
                    
                    console.groupCollapsed("2단계: 자전거");
                    const endStation = findNearestStation(end, stations);
                    if (!endStation) { alert("도착지 1km 내에 따릉이 대여소가 없습니다."); console.groupEnd(); console.groupEnd(); return; }
                    const { segment1, transferStation } = await fetchTimedBikeSegments(startStation, endStation, stations, bikeTimeSec);
                    const bikeSec = segment1.routes[0].summary.duration;
                    const bikeSubPath = { trafficType: 4, laneColor: ROUTE_COLORS.BIKE, startName: startStation.stationName.replace(/^\d+\.\s*/, ''), endName: transferStation.stationName.replace(/^\d+\.\s*/, ''), sectionTime: Math.round(bikeSec / 60) };
                    const bikePath = polyline.decode(segment1.routes[0].geometry, 5).map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
                    const bikeSegment = { type: 'bike', color: ROUTE_COLORS.BIKE, coords: bikePath };
                    console.groupEnd();

                    console.groupCollapsed("3단계: 환승→도착");
                    const resEnd = await fetchOdsayRoute({ y: +transferStation.stationLatitude, x: +transferStation.stationLongitude }, { y: end.lat, x: end.lng });
                    const endSubPaths = resEnd?.result?.path[0]?.subPath || [];
                    const endSegments = resEnd.error ? [] : await processOdsayPath(resEnd.result.path[0], {lat: +transferStation.stationLatitude, lng: +transferStation.stationLongitude}, end);
                    console.groupEnd();

                    // 각 단계별로 구한 경로들을 하나로 합칩니다.
                    const combinedSubPath = [...startSubPaths, bikeSubPath, ...endSubPaths];
                    finalSegments = [...startSegments, bikeSegment, ...endSegments];
                    // 총 소요시간 계산 시, 수동으로 만든 도보 경로의 시간(startSubPaths[0]?.sectionTime)도 고려합니다.
                    summaryData = { info: { totalTime: (resStart?.result?.path[0]?.info.totalTime || startSubPaths[0]?.sectionTime || 0) + Math.round(bikeSec / 60) + (resEnd?.result?.path[0]?.info.totalTime || 0) }, subPath: combinedSubPath };
                }

                // 경로 요약 정보에 출발지/도착지 이름을 명시적으로 추가합니다.
                if (summaryData && summaryData.subPath && summaryData.subPath.length > 0) {
                  // 첫 번째 경로가 도보일 경우, 출발지 이름과 도착지(대여소) 이름을 설정합니다.
                  if (summaryData.subPath[0].trafficType === 3) {
                    summaryData.subPath[0].startName = start.name;
                    const firstBikeSegment = summaryData.subPath.find(p => p.trafficType === 4);
                    if(firstBikeSegment) {
                        summaryData.subPath[0].endName = firstBikeSegment.startName;
                    }
                  }
                  // 마지막 경로가 도보일 경우, 도착지 이름을 설정합니다.
                  const lastIndex = summaryData.subPath.length - 1;
                  if (summaryData.subPath[lastIndex].trafficType === 3) {
                    summaryData.subPath[lastIndex].endName = end.name;
                  }
                }
                
                // 최종적으로 계산된 경로와 요약 정보를 상태에 저장하여 UI를 업데이트합니다.
                setRouteSegments(finalSegments);
                setRouteSummary(summaryData);

                const allCoords = finalSegments.flatMap(s => s.coords);
                if (import.meta.env.DEV) window.__coords = allCoords;

                // 모든 경로가 보이도록 지도의 경계와 확대 레벨을 조절합니다.
                if (allCoords.length > 1) {
                    const bounds = allCoords.reduce((b, p) => b.extend(p), new window.naver.maps.LatLngBounds(allCoords[0], allCoords[0]));
                    mapInstance.fitBounds(bounds, 100);
                }
                console.groupEnd();
            } catch (err) {
                console.error("[IntegratedRoute] 경로 생성 중 에러 발생:", err);
                setRouteSummary(null);
            }
        };
        
        calculateAndDrawRoute();

        // 컴포넌트가 언마운트되거나 props가 변경될 때 실행될 클린업 함수입니다.
        return () => {
            setRouteSegments([]);
            setRouteSummary(null);
        };
    }, [mapInstance, start, end, stations, bikeTimeSec, setRouteSummary]);

    // 이 컴포넌트는 RouteLine 컴포넌트를 통해 지도에 선을 그리는 역할만 합니다.
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