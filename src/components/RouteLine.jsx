// src/components/RouteLine.jsx
import { useEffect, useRef } from "react";

/**
 * props
 * - map    : naver.maps.Map 인스턴스
 * - coords : naver.maps.LatLng 객체 배열 (길이 ≥ 2)
 */
export default function RouteLine({ map, coords, color = "#3880ff" }) {
  const lineRef = useRef(null);

  useEffect(() => {
    if (!map || !Array.isArray(coords) || coords.length < 2) return;

    /* 1) 기존 선 제거 */
    if (lineRef.current) {
      lineRef.current.setMap(null);
      lineRef.current = null;
    }

    /* 2) path = 이미 LatLng 객체 배열 → 그대로 사용 */
    const path = coords;

    /* 3) Polyline 생성 */
    lineRef.current = new naver.maps.Polyline({
      map,
      path,
      strokeWeight: 4,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeStyle: "solid",
    });

    /* 4) 화면에 전 경로가 보이도록 */
    const bounds = path.reduce(
      (b, p) => (b.extend(p), b),
      new naver.maps.LatLngBounds(path[0], path[0])
    );
    map.fitBounds(bounds);

    /* 언마운트 시 정리 */
    return () => {
      if (lineRef.current) lineRef.current.setMap(null);
    };
  }, [map, coords]);

  return null; // DOM 요소 없음
}
