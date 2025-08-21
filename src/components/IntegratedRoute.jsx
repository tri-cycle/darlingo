// src/components/IntegratedRoute.jsx
import React, { useEffect } from "react";
import RouteLine from "./RouteLine";
import haversine from "../utils/haversine"; // 거리 계산을 위해 import

// 거리에 따라 적절한 줌 레벨을 반환하는 함수
function getZoomLevelForDistance(distance) {
  if (distance > 40000) return 10;
  if (distance > 20000) return 11;
  if (distance > 10000) return 12;
  if (distance > 5000) return 13;
  if (distance > 2500) return 14;
  if (distance > 1200) return 15;
  return 16; // 1.2km 미만
}


export default function IntegratedRoute({
    mapInstance,
    routes,
    selectedIndex,
}) {
    const selectedRoute = routes?.[selectedIndex];

    useEffect(() => {
        if (!mapInstance || !selectedRoute?.segments) return;

        const allCoords = selectedRoute.segments.flatMap(segment => segment?.coords || []);
        if (allCoords.length < 2) {
            if (allCoords.length === 1) mapInstance.setCenter(allCoords[0]);
            return;
        }

        // ✨ [요청 사항 반영] fitBounds 대신 직접 중심과 줌 레벨을 계산하는 방식으로 변경
        
        // 1. 전체 경로를 감싸는 경계(bounds)를 계산합니다.
        const bounds = allCoords.reduce(
            (b, p) => b.extend(p),
            new window.naver.maps.LatLngBounds(allCoords[0], allCoords[0])
        );

        // 2. 경계의 중심점을 지도의 중심으로 설정합니다.
        mapInstance.setCenter(bounds.getCenter());

        // 3. 경로의 실제 시작점과 끝점 사이의 직선 거리를 계산합니다.
        const startPoint = allCoords[0];
        const endPoint = allCoords[allCoords.length - 1];
        const distance = haversine(startPoint.lat(), startPoint.lng(), endPoint.lat(), endPoint.lng());
        
        // 4. 거리에 맞는 줌 레벨을 설정합니다.
        const zoom = getZoomLevelForDistance(distance);
        mapInstance.setZoom(zoom);

    }, [selectedIndex, selectedRoute, mapInstance]);

    const currentSegments = selectedRoute?.segments || [];

    return (
        <>
            {currentSegments.map((segment, index) => (
                segment && <RouteLine
                    key={`${selectedIndex}-${index}`} 
                    map={mapInstance}
                    coords={segment.coords}
                    color={segment.color}
                />
            ))}
        </>
    );
}