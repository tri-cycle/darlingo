// src/components/RouteStationMarkers.jsx
import { useEffect, useRef } from "react";
import haversine from "../utils/haversine";

const STATION_SEARCH_RADIUS = 300; 

export default function RouteStationMarkers({ map, selectedRoute, allStations }) {
    // ✨ [문제 해결] 생성된 마커들을 저장할 '보관함'(useRef)을 만듭니다.
    const markersRef = useRef([]);

    useEffect(() => {
        // 1. (가장 중요) 새로운 마커를 그리기 전에, 보관함에 있던 모든 마커를 지도에서 제거합니다.
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = []; // 보관함 배열을 비웁니다.

        if (!map || !selectedRoute?.summary?.subPath || !allStations) return;

        const bikeSegments = selectedRoute.summary.subPath.filter(path => path.trafficType === 4);
        if (bikeSegments.length === 0) return;

        const startStationName = bikeSegments[0].startName;
        const endStationName = bikeSegments[bikeSegments.length - 1].endName;
        
        const startStation = allStations.find(s => s.stationName.includes(startStationName));
        const endStation = allStations.find(s => s.stationName.includes(endStationName));
        
        const pointsToSearch = [];
        if (startStation) pointsToSearch.push({ station: startStation, type: 'start' });
        if (endStation && startStation?.stationId !== endStation?.stationId) {
            pointsToSearch.push({ station: endStation, type: 'end' });
        }

        const newMarkers = [];
        const addedStationIds = new Set();

        pointsToSearch.forEach(pointInfo => {
            const { station, type } = pointInfo;
            const centerLat = parseFloat(station.stationLatitude);
            const centerLng = parseFloat(station.stationLongitude);

            allStations.forEach(s => {
                if (addedStationIds.has(s.stationId)) return;

                const lat = parseFloat(s.stationLatitude);
                const lng = parseFloat(s.stationLongitude);
                if (isNaN(lat) || isNaN(lng)) return;

                const dist = haversine(centerLat, centerLng, lat, lng);

                if (dist <= STATION_SEARCH_RADIUS) {
                    const color = type === 'start' ? '#3498db' : '#e74c3c';
                    const marker = new window.naver.maps.Marker({
                        position: new window.naver.maps.LatLng(lat, lng),
                        map,
                        title: s.stationName,
                        icon: {
                            content: `<div style="background-color: ${color}; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚲</div>`,
                            anchor: new window.naver.maps.Point(11, 11),
                        },
                        zIndex: 101
                    });
                    newMarkers.push(marker);
                    addedStationIds.add(s.stationId);
                }
            });
        });

        // 2. 새로 생성된 마커 목록을 보관함에 저장하여, 다음 실행 때 제거할 수 있도록 합니다.
        markersRef.current = newMarkers;

    }, [map, selectedRoute, allStations]);

    return null;
}