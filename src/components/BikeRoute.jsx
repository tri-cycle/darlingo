// src/components/BikeRoute.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { fetchBikeRoute } from "../utils/fetchBikeRoute";
import polyline from "polyline";  // npm install polyline

// 컴포넌트 파일이 로드될 때 한 번만 실행
console.log("🔍 BikeRoute 컴포넌트 로드");

export default function BikeRoute({ mapInstance, from, to }) {
  // 렌더링 시 매번 실행
  console.log("🔍 BikeRoute 렌더링됨", { from, to, mapInstance });

  const [route, setRoute] = useState(null);
  const polylineRef = useRef(null);

  // 좌표 배열이 참조 변경되어도 동일한 좌표로 인식되도록 키 문자열 생성
  const fromKey = useMemo(() => (from ? from.join(",") : ""), [from]);
  const toKey = useMemo(() => (to ? to.join(",") : ""), [to]);

  useEffect(() => {
    console.log("🚀 ORS useEffect 시작");
    if (!mapInstance || !from || !to) {
      console.log("❌ ORS 호출 조건 불충분", { mapInstance, from, to });
      return;
    }

    (async () => {
      try {
        const data = await fetchBikeRoute([from, to]);
        console.log("✅ ORS 응답 성공:", data.routes[0].summary);
        setRoute(data.routes[0]);
      } catch (err) {
        console.error("❌ ORS 호출 실패:", err);
      }
    })();
  }, [mapInstance, fromKey, toKey]);

  useEffect(() => {
    if (!mapInstance || !route) return;

    // 이전 폴리라인 제거
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    // 인코딩된 폴리라인 해제
    const coords = polyline.decode(route.geometry);
    const path = coords.map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));

    // 네이버 지도에 폴리라인 그리기
    polylineRef.current = new window.naver.maps.Polyline({
      map: mapInstance,
      path,
      strokeWeight: 4,
      strokeColor: "#3880ff",
      strokeOpacity: 0.8,
    });
  }, [mapInstance, route]);

  return null;
}
