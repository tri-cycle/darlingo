// src/components/RouteLine.jsx
import { useEffect, useRef } from "react";

/**
 * props
 * - map    : naver.maps.Map 인스턴스
 * - coords : naver.maps.LatLng 객체 배열 (길이 ≥ 2)
 * - color  : 경로 선의 색상
 */
export default function RouteLine({ map, coords, color = "#3880ff" }) {
  const lineRef = useRef(null);

  useEffect(() => {
    if (!map || !Array.isArray(coords) || coords.length < 2) return;

    /* 1) 기존 선이 있다면 제거 */
    if (lineRef.current) {
      lineRef.current.setMap(null);
      lineRef.current = null;
    }

    /* 2) Polyline을 그리기 위한 경로(path) 설정 */
    const path = coords;

    /* 3) 새로운 Polyline 생성 및 지도에 추가 */
    lineRef.current = new window.naver.maps.Polyline({
      map,
      path,
      strokeWeight: 4,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeStyle: "solid",
    });
    
    // --- 수정된 부분 ---
    // 아래 map.fitBounds 코드를 삭제하거나 주석 처리합니다.
    // 이 코드가 각 경로 조각마다 지도를 확대시켜서, 마지막 조각만 보이게 되는 원인이었습니다.
    // 전체 경로를 보여주는 기능은 상위 컴포넌트인 IntegratedRoute.jsx에서 담당합니다.
    /*
    const bounds = path.reduce(
      (b, p) => (b.extend(p), b),
      new window.naver.maps.LatLngBounds(path[0], path[0])
    );
    map.fitBounds(bounds);
    */
    // --- 여기까지 수정 ---

    /* 컴포넌트가 사라질 때(unmount) 그려진 선을 지도에서 제거합니다. */
    return () => {
      if (lineRef.current) {
        lineRef.current.setMap(null);
      }
    };
  }, [map, coords, color]); // color도 종속성 배열에 추가

  return null; // 이 컴포넌트는 화면에 아무것도 렌더링하지 않습니다.
}