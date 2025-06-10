// src/components/TimedBikeRoute.jsx
import React, { useEffect } from "react";
import { fetchTimedBikeSegments } from "../utils/splitBikeRoute";
import polyline from "polyline";
import haversine from "../utils/haversine";

export default function TimedBikeRoute({
  mapInstance,
  start,
  end,
  stations,
  bikeTimeSec,
}) {
  useEffect(() => {
    if (
      !mapInstance ||
      !start ||
      !end ||
      stations.length === 0 ||
      !bikeTimeSec
    )
      return;

    (async () => {
      try {
        // 가장 가까운 출발/도착 대여소 찾기
        const nearestStart = findNearest(start, stations);
        const nearestEnd   = findNearest(end,   stations);

        // 분할된 경로 가져오기
        const { segment1, segment2, transferStation } =
          await fetchTimedBikeSegments(
            nearestStart,
            nearestEnd,
            stations,
            bikeTimeSec
          );

        // 1) 출발→환승 구간 그리기
        drawPolyline(segment1, "#3880ff");
        // 2) 환승→도착 구간 그리기
        drawPolyline(segment2, "#3880ff");

        // 마커 추가
        addMarker(nearestStart,     "🚲 출발 대여소");
        addMarker(transferStation,  "🔄 환승 대여소");
        addMarker(nearestEnd,       "🚲 도착 대여소");
      } catch (e) {
        console.error("TimedBikeRoute 에러:", e);
      }
    })();
  }, [mapInstance, start, end, stations, bikeTimeSec]);

  return null;

  // 헬퍼: 네이버 지도 폴리라인 그리기
  function drawPolyline(data, color) {
    const coords = polyline.decode(data.routes[0].geometry);
    const path = coords.map(
      ([lat, lng]) => new window.naver.maps.LatLng(lat, lng)
    );
    new window.naver.maps.Polyline({
      map: mapInstance,
      path,
      strokeColor: color,
      strokeWeight: 4,
    });
  }

  // 헬퍼: 마커 추가
  function addMarker(st, title) {
    new window.naver.maps.Marker({
      position: new window.naver.maps.LatLng(
        +st.stationLatitude,
        +st.stationLongitude
      ),
      map: mapInstance,
      title,
    });
  }

  // 헬퍼: 주어진 지점(point={lat,lng})에 가장 가까운 대여소 찾기
  function findNearest(point, stations) {
    return stations.reduce((prev, curr) => {
      const dPrev = haversine(point.lat, point.lng, +prev.stationLatitude, +prev.stationLongitude);
      const dCurr = haversine(point.lat, point.lng, +curr.stationLatitude, +curr.stationLongitude);
      return dPrev < dCurr ? prev : curr;
    });
  }

  // 하버사인 거리 계산 함수는 utils/haversine.js에서 가져옵니다.
}
