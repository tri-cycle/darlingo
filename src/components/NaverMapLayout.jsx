// src/components/NaverMapLayout.jsx
import React, { useState, useEffect } from "react";
import MapLoader from "./MapLoader";
import MapView from "./MapView";
import DdarungiMarkers from "./DdarungiMarkers";

export default function NaverMapLayout({ center, stations, route }) {
  const [mapInstance, setMapInstance] = useState(null);

  // 출발지 마커 찍기
  useEffect(() => {
    if (!mapInstance || !center) return;

    new window.naver.maps.Marker({
      position: new window.naver.maps.LatLng(center.lat, center.lng),
      map: mapInstance,
      title: "출발지",
      icon: {
        content:
          '<div style="background:#1E90FF;color:white;padding:4px 8px;border-radius:6px;">출발</div>'
      }
    });
  }, [mapInstance, center]);

  // 경로 표시 (Polyline)
  useEffect(() => {
    if (!mapInstance || !route || route.length < 2) return;

    const path = route.map((point) =>
      new window.naver.maps.LatLng(point.lat, point.lng)
    );

    new window.naver.maps.Polyline({
      map: mapInstance,
      path,
      strokeColor: "#4CAF50",
      strokeOpacity: 0.8,
      strokeWeight: 4
    });
  }, [mapInstance, route]);

  return (
    <div className="flex h-screen w-screen">
      {/* 사이드 메뉴 */}
      <aside className="w-64 bg-white border-r p-4 shadow-md z-10">
        <h2 className="text-xl font-bold mb-4">따릉이:Go</h2>
        <div className="space-y-2">
          <button className="w-full bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded">경로 검색</button>
          <button className="w-full bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded">내 주변 대여소</button>
          <button className="w-full bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded">설정</button>
        </div>
      </aside>

      {/* 지도와 컨텐츠 */}
      <div className="flex-1 relative">
        {/* 상단 필터 버튼 */}
        <div className="absolute top-4 left-4 flex gap-2 z-10">
          {[
            "음식점",
            "카페",
            "편의점",
            "공공자전거"
          ].map((label) => (
            <button
              key={label}
              className="bg-white text-sm px-3 py-1 rounded-full shadow hover:bg-gray-100"
            >
              {label}
            </button>
          ))}
        </div>

        {/* 네이버 지도 표시 영역 */}
        <MapLoader>
          <>
            <MapView center={center} onMapLoad={setMapInstance} />
            <DdarungiMarkers map={mapInstance} center={center} stations={stations} />
          </>
        </MapLoader>

        {/* 지도 오른쪽 툴바 */}
        <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col items-center gap-2 z-10">
          <button className="bg-white p-2 rounded shadow hover:bg-gray-100">📏</button>
          <button className="bg-white p-2 rounded shadow hover:bg-gray-100">📍</button>
          <button className="bg-white p-2 rounded shadow hover:bg-gray-100">🗺️</button>
        </div>
      </div>
    </div>
  );
}
