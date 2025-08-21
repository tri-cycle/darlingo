// src/components/LocationMarkers.jsx
import { useEffect, useRef } from "react";

const createMarkerIcon = (color, label) => `
  <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
    <svg viewBox="0 0 384 512" style="width: 100%; height: 100%; fill: ${color}; stroke: #fff; stroke-width: 10px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
      <path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0z"/>
    </svg>
    <span style="position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 14px; font-weight: bold;">
      ${label}
    </span>
  </div>
`;

export default function LocationMarkers({ map, start, end }) {
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);

  useEffect(() => {
    // 출발지 마커 관리
    if (startMarkerRef.current) {
      startMarkerRef.current.setMap(null);
    }
    if (map && start) {
      startMarkerRef.current = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(start.lat, start.lng),
        map,
        title: "출발지",
        icon: {
          content: createMarkerIcon("#3498db", "출"),
          anchor: new window.naver.maps.Point(16, 32),
        },
        zIndex: 200,
      });
    }

    // 도착지 마커 관리
    if (endMarkerRef.current) {
      endMarkerRef.current.setMap(null);
    }
    if (map && end) {
      endMarkerRef.current = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(end.lat, end.lng),
        map,
        title: "도착지",
        icon: {
          content: createMarkerIcon("#e74c3c", "도"),
          anchor: new window.naver.maps.Point(16, 32),
        },
        zIndex: 200,
      });
    }

    // ✨ '뒷정리' 함수를 추가하여 마커를 확실하게 제거합니다.
    return () => {
      if (startMarkerRef.current) startMarkerRef.current.setMap(null);
      if (endMarkerRef.current) endMarkerRef.current.setMap(null);
    }

  }, [map, start, end]);

  return null;
}