// src/components/DdarungiMarkers.jsx
import { useEffect } from "react";
import haversine from "../utils/haversine";

export default function DdarungiMarkers({ map, center, stations }) {
  useEffect(() => {
    if (!map || !center || !stations) return;

    // (선택) 기존에 찍힌 marker를 모두 제거하려면
    // map.clearOverlays && map.clearOverlays();

    stations.forEach((station) => {
      // 문자열로 들어온 좌표를 숫자로 변환
      const lat = parseFloat(station.stationLatitude);
      const lng = parseFloat(station.stationLongitude);

      // 출발지와 따릉이 대여소 사이 거리 계산
      const dist = haversine(center.lat, center.lng, lat, lng);

      // 100m 이내인 경우에만 마커 생성
      if (dist <= 100) {
        new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(lat, lng),
          map,
          title: station.stationName,
        });
      }
    });
  }, [map, center, stations]);

  return null;
}
