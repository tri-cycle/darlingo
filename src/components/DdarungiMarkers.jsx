// src/components/DdarungiMarkers.jsx
import { useEffect, useRef } from "react";
import haversine from "../utils/haversine";
import { NEARBY_RADIUS_METERS } from "../utils/constants";

export default function DdarungiMarkers({ map, center, stations }) {
  // ✨ [문제 해결] 생성된 마커들을 저장할 '보관함'(useRef)을 만듭니다.
  const markersRef = useRef([]);

  useEffect(() => {
    // 1. (가장 중요) 새로운 마커를 그리기 전에, 보관함에 있던 모든 마커를 지도에서 제거합니다.
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = []; // 보관함 배열을 비웁니다.

    // 지도, 중심점, 대여소 데이터가 없으면 아무 작업도 하지 않습니다.
    if (!map || !center || !stations) return;
    
    const newMarkers = [];
    stations.forEach((station) => {
      const lat = parseFloat(station.stationLatitude);
      const lng = parseFloat(station.stationLongitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const dist = haversine(center.lat, center.lng, lat, lng);

      if (dist <= NEARBY_RADIUS_METERS) {
        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(lat, lng),
          map,
          title: station.stationName,
          icon: {
            content: `<div style="background-color: #4CAF50; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚲</div>`,
            anchor: new window.naver.maps.Point(14, 14),
          },
        });
        newMarkers.push(marker);
      }
    });

    // 2. 새로 생성된 마커 목록을 보관함에 저장하여, 다음 실행 때 제거할 수 있도록 합니다.
    markersRef.current = newMarkers;
    
  }, [map, center, stations]); // map, center, stations가 변경될 때마다 이 로직이 다시 실행됩니다.

  return null;
}