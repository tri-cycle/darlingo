// src/components/MapView.jsx
import React, { useEffect, useRef } from "react";
import useCurrentLocation from "../hooks/useCurrentLocation";

export default function MapView({ center, onMapLoad, className = "" }) {
  const { location, error } = useCurrentLocation();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const effectiveCenter = center || location;

  const handleZoomIn = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.setZoom(map.getZoom() + 1);
    }
  };

  const handleZoomOut = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.setZoom(map.getZoom() - 1);
    }
  };

  useEffect(() => {
    // center 또는 naver 미정의 시 지도 생성 스킵
    if (!mapRef.current || !effectiveCenter) return;

    // Naver Maps API 로드 확인
    if (!window.naver || !window.naver.maps) return;

    // 기존 맵 지우기
    mapRef.current.innerHTML = "";

    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(
        effectiveCenter.lat,
        effectiveCenter.lng
      ),
    });

    const zoomControl = new window.naver.maps.ZoomControl();
    const position = window.naver.maps.Position.RIGHT_BOTTOM;

    const addZoomControl = () => {
      if (map.controls && map.controls[position]) {
        map.controls[position].push(zoomControl);
      } else {
        map.addControl(zoomControl, position);
      }
    };

    if (map.controls && map.controls[position]) {
      addZoomControl();
    } else {
      window.naver.maps.Event.once(map, "init", addZoomControl);
    }

    mapInstanceRef.current = map;

    // 부모에 인스턴스 전달
    onMapLoad?.(map);
  }, [effectiveCenter, onMapLoad]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={mapRef} className="w-full h-full" />
      {error && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white p-2 text-red-600 rounded shadow">
          {error}
        </div>
      )}
      <div className="absolute top-2 left-2 flex flex-col space-y-1">
        <button
          type="button"
          onClick={handleZoomIn}
          className="bg-white border rounded px-2"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="bg-white border rounded px-2"
        >
          -
        </button>
      </div>
    </div>
  );
}
