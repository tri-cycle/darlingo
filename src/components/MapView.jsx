// src/components/MapView.jsx
import React, { useEffect, useRef } from "react";
import useCurrentLocation from "../hooks/useCurrentLocation";

export default function MapView({ center, onMapLoad, className = "" }) {
  const { location, error } = useCurrentLocation();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null); // 지도 인스턴스를 저장할 ref
  const userMarkerRef = useRef(null);
  
  // App.jsx에서 center prop을 주면 그것을, 아니면 현재 위치를 사용
  const effectiveCenter = center || location;

  // --- 줌인/줌아웃/GPS 핸들러 ---
  const handleZoomIn = () => {
    const map = mapInstanceRef.current;
    if (map) map.setZoom(map.getZoom() + 1);
  };

  const handleZoomOut = () => {
    const map = mapInstanceRef.current;
    if (map) map.setZoom(map.getZoom() - 1);
  };

  const handleGpsClick = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 정보를 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const latlng = new window.naver.maps.LatLng(latitude, longitude);
        map.setCenter(latlng);
        if (userMarkerRef.current) {
          userMarkerRef.current.setPosition(latlng);
        } else {
          userMarkerRef.current = new window.naver.maps.Marker({ position: latlng, map });
        }
      },
      (err) => {
        // 에러 핸들링
        switch (err.code) {
            case err.PERMISSION_DENIED:
              alert("위치 정보 사용이 거부되었습니다.");
              break;
            case err.POSITION_UNAVAILABLE:
              alert("위치 정보를 사용할 수 없습니다.");
              break;
            case err.TIMEOUT:
              alert("위치 정보를 가져오는 데 시간이 초과되었습니다.");
              break;
            default:
              alert("현재 위치를 가져오는데 실패했습니다.");
        }
      }
    );
  };

  // 1. 지도 생성 useEffect: 최초 한 번만 실행됩니다.
  useEffect(() => {
    if (!mapRef.current || !window.naver || !window.naver.maps || !effectiveCenter) return;

    // 지도를 생성하고 ref에 저장합니다.
    const map = new window.naver.maps.Map(mapRef.current, {
        center: new window.naver.maps.LatLng(
            effectiveCenter.lat,
            effectiveCenter.lng
        ),
        zoom: 15, // 기본 줌 레벨 설정
    });

    mapInstanceRef.current = map;
    
    // 생성된 지도 인스턴스를 부모(App.jsx)에게 **딱 한 번만** 전달합니다.
    if (onMapLoad) {
      onMapLoad(map);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMapLoad]);

  // 2. 지도 중심 이동 useEffect: effectiveCenter가 바뀔 때마다 실행됩니다.
  useEffect(() => {
    if (!mapInstanceRef.current || !effectiveCenter) return;

    // 새로운 좌표로 지도 중심을 부드럽게 이동시킵니다.
    const newCenter = new window.naver.maps.LatLng(
      effectiveCenter.lat,
      effectiveCenter.lng
    );
    mapInstanceRef.current.panTo(newCenter);

  }, [effectiveCenter]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={mapRef} className="w-full h-full" />
      
      {/* 에러 메시지 */}
      {error && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-red-700 text-sm font-medium">{error}</span>
            </div>
          </div>
        </div>
      )}

      {/* 줌 컨트롤 */}
      <div className="absolute top-6 right-6 z-20 flex flex-col space-y-2">
        <button 
          type="button" 
          onClick={handleZoomIn} 
          className="w-12 h-12 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg hover:bg-white hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        >
          <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button 
          type="button" 
          onClick={handleZoomOut} 
          className="w-12 h-12 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg hover:bg-white hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        >
          <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>

      {/* GPS 버튼 */}
      <button 
        type="button" 
        onClick={handleGpsClick} 
        className="absolute right-6 bottom-6 z-20 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 flex items-center justify-center group transform hover:scale-105" 
        aria-label="내 위치로 이동"
      >
        <svg className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364 6.364l-1.414-1.414M8.05 8.05L6.636 6.636m0 10.728l1.414-1.414m8.486-8.486l1.414-1.414" />
        </svg>
      </button>
    </div>
  );
}