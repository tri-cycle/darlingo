import { useRef, useEffect } from "react";

export default function useMarkers(map, initialMarkers = []) {
  const markersRef = useRef([]);
  const mapRef = useRef(map);

  useEffect(() => {
    mapRef.current = map;
    // 지도 변경 시, 현재 저장된 마커들을 새 지도에 다시 표시합니다.
    markersRef.current.forEach(marker => marker.setMap(map));
  }, [map]);

  const setMarkers = (nextMarkers = []) => {
    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // 새 마커를 지도에 추가
    if (mapRef.current) {
      nextMarkers.forEach(marker => marker.setMap(mapRef.current));
      markersRef.current = nextMarkers;
    }
  };

  useEffect(() => {
    setMarkers(initialMarkers);
  }, [initialMarkers]);

  return setMarkers;
}
