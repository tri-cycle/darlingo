// src/components/MapView.jsx
import React, { useEffect, useRef } from "react";
import useCurrentLocation from "../hooks/useCurrentLocation";

export default function MapView({ center, onMapLoad, onCurrentLocationClick, className = "" }) {
  const { location, error } = useCurrentLocation();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userCircleRef = useRef(null);
  
  const effectiveCenter = center || location;

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
    
    // 현재 위치로 통계 초기화
    if (onCurrentLocationClick) {
      onCurrentLocationClick();
    }
    
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 정보를 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const latlng = new window.naver.maps.LatLng(latitude, longitude);
        map.setCenter(latlng);
        map.setZoom(16);
        
        // 기존 마커와 원 제거
        if (userMarkerRef.current) {
          userMarkerRef.current.setMap(null);
        }
        if (userCircleRef.current) {
          userCircleRef.current.setMap(null);
        }
        
        // 정확도 표시 원 생성
        userCircleRef.current = new window.naver.maps.Circle({
          map: map,
          center: latlng,
          radius: pos.coords.accuracy || 50,
          fillColor: '#4285F4',
          fillOpacity: 0.15,
          strokeColor: '#4285F4',
          strokeOpacity: 0.4,
          strokeWeight: 1,
          zIndex: 100
        });
        
        // 현재 위치 마커 생성
        userMarkerRef.current = new window.naver.maps.Marker({
          position: latlng,
          map: map,
          icon: {
            content: `
              <div style="position: relative; width: 24px; height: 24px;">
                <!-- 외곽 펄스 애니메이션 -->
                <div style="
                  position: absolute;
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  background: rgba(66, 133, 244, 0.3);
                  animation: pulse 2s ease-out infinite;
                "></div>
                
                <!-- 중간 원 -->
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: #4285F4;
                  border: 3px solid white;
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                "></div>
                
                <!-- 중심점 -->
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background: white;
                "></div>
              </div>
              <style>
                @keyframes pulse {
                  0% {
                    transform: scale(1);
                    opacity: 1;
                  }
                  100% {
                    transform: scale(2.5);
                    opacity: 0;
                  }
                }
              </style>
            `,
            anchor: new window.naver.maps.Point(12, 12)
          },
          zIndex: 200
        });
        
        // 인포윈도우 생성
        const infoWindow = new window.naver.maps.InfoWindow({
          content: `
            <div style="
              padding: 12px 16px;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.15);
              border: none;
            ">
              <div style="
                font-weight: bold;
                font-size: 13px;
                color: #1f2937;
                display: flex;
                align-items: center;
                gap: 8px;
              ">
                <span style="
                  display: inline-block;
                  width: 8px;
                  height: 8px;
                  border-radius: 50%;
                  background: #4285F4;
                  animation: blink 1.5s ease-in-out infinite;
                "></span>
                현재 위치
              </div>
              <div style="
                font-size: 11px;
                color: #6b7280;
                margin-top: 4px;
              ">
                정확도: ±${Math.round(pos.coords.accuracy)}m
              </div>
            </div>
            <style>
              @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
              }
            </style>
          `,
          borderWidth: 0,
          backgroundColor: 'transparent',
          disableAnchor: true,
          pixelOffset: new window.naver.maps.Point(0, -15)
        });
        
        // 마커 클릭 시 인포윈도우 표시
        window.naver.maps.Event.addListener(userMarkerRef.current, 'click', () => {
          if (infoWindow.getMap()) {
            infoWindow.close();
          } else {
            infoWindow.open(map, userMarkerRef.current);
          }
        });
      },
      (err) => {
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
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    if (!mapRef.current || !window.naver || !window.naver.maps || !effectiveCenter) return;

    // 서울 영역 경계 설정
    const seoulBounds = new window.naver.maps.LatLngBounds(
      new window.naver.maps.LatLng(37.413294, 126.734086), // 남서쪽 모서리
      new window.naver.maps.LatLng(37.715133, 127.269311)  // 북동쪽 모서리
    );

    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(
        effectiveCenter.lat,
        effectiveCenter.lng
      ),
      zoom: 15,
      minZoom: 11, // 서울 전체가 보이는 최소 줌 레벨
      maxZoom: 19, // 최대 확대 레벨
      maxBounds: seoulBounds, // 서울 영역으로 제한
      // 추가 제한 옵션
      draggable: true,
      pinchZoom: true,
      scrollWheel: true,
      keyboardShortcuts: true,
      disableDoubleTapZoom: false,
      disableDoubleClickZoom: false,
      disableTwoFingerTapZoom: false
    });

    mapInstanceRef.current = map;
    
    if (onMapLoad) {
      onMapLoad(map);
    }
  }, [onMapLoad]);

  useEffect(() => {
    if (!mapInstanceRef.current || !effectiveCenter) return;

    const newCenter = new window.naver.maps.LatLng(
      effectiveCenter.lat,
      effectiveCenter.lng
    );
    mapInstanceRef.current.panTo(newCenter);

  }, [effectiveCenter]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={mapRef} className="w-full h-full" />
      
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