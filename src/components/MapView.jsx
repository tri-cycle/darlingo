// src/components/MapView.jsx
import React, { useEffect, useRef } from "react";
import useCurrentLocation from "../hooks/useCurrentLocation";

export default function MapView({ center, onMapLoad, onMapClick, className = "" }) {
  const { location, error } = useCurrentLocation();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
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
          userMarkerRef.current = new window.naver.maps.Marker({
            position: latlng,
            map,
          });
        }
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
      }
    );
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

    // 지도 클릭 이벤트 리스너 등록
    if (onMapClick) {
      window.naver.maps.Event.addListener(map, "click", (e) => {
        onMapClick({ lat: e.coord.lat(), lng: e.coord.lng() });
      });
    }

    // 부모에 인스턴스 전달
    onMapLoad?.(map);
  }, [effectiveCenter, onMapLoad, onMapClick]);

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
      <button
        type="button"
        onClick={handleGpsClick}
        className="absolute right-2 bottom-20 bg-white border rounded-full p-2 shadow"
        aria-label="내 위치로 이동"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-6 h-6"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364 6.364l-1.414-1.414M8.05 8.05L6.636 6.636m0 10.728l1.414-1.414m8.486-8.486l1.414-1.414" />
        </svg>
      </button>
    </div>
  );
}
