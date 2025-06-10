// src/components/MapView.jsx
import React, { useEffect, useRef } from "react";

export default function MapView({ center, onMapLoad,className = "" }) {
  const mapRef = useRef(null);

  useEffect(() => {
    // center 또는 naver 미정의 시 지도 생성 스킵
    if (!window.naver || !mapRef.current || !center) return;

    // 기존 맵 지우기
    mapRef.current.innerHTML = "";

    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(center.lat, center.lng),
      
    });

    // 부모에 인스턴스 전달
    onMapLoad?.(map);
  }, [center, onMapLoad]);

  return (
    <div
      ref={mapRef}
      className={`${className}`} 
    />
  );
}
