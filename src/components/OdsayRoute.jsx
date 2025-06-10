// src/components/OdsayRoute.jsx
import { useEffect, useRef } from "react";

// VITE_ODSAY_API_KEY 를 .env 에 설정해야 합니다.
const ODSAY_KEY = import.meta.env.VITE_ODSAY_API_KEY;

export default function OdsayRoute({ map, start, end }) {
  // 이전에 생성한 polyline·markers 를 참조해서 지울 수 있도록 ref에 저장
  const polyRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!map || !start || !end) return;

    // 이전 polyline·marker 제거
    if (polyRef.current) {
      polyRef.current.setMap(null);
      markersRef.current.forEach((m) => m.setMap(null));
    }
    markersRef.current = [];

    // API 호출 URL (apiKey 맨 앞에!)
    const url =
      "https://api.odsay.com/v1/api/searchPubTransPath?" +
      `apiKey=${ODSAY_KEY}` +
      `&SX=${start.lng}&SY=${start.lat}` +
      `&EX=${end.lng}&EY=${end.lat}` +
      `&lang=0`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error("ODsay 에러:", data.error.msg);
          return;
        }
        const pathResult = data.result.path?.[0];
        if (!pathResult) {
          console.warn("경로 데이터가 없습니다.");
          return;
        }

        // * 대중교통 정류장만 coords 에 담기 *
        const coords = [];
        pathResult.subPath.forEach((sub, idx) => {
          // passStopList.stations 이 있으면 버스/지하철
          if (
            sub.passStopList &&
            Array.isArray(sub.passStopList.stations)
          ) {
            sub.passStopList.stations.forEach((stop) => {
              coords.push(
                new window.naver.maps.LatLng(
                  parseFloat(stop.y),
                  parseFloat(stop.x)
                )
              );
            });
            // 환승 지점(첫 구간 제외)
            if (idx !== 0) {
              const first = sub.passStopList.stations[0];
              const m = new window.naver.maps.Marker({
                position: new window.naver.maps.LatLng(
                  parseFloat(first.y),
                  parseFloat(first.x)
                ),
                map,
                icon: {
                  content:
                    '<div style="background:white;width:12px;height:12px;border-radius:50%;border:2px solid #333"></div>',
                },
              });
              markersRef.current.push(m);
            }
          }
          // else → 도보 구간: 완전히 무시 (폴리곤 교차를 줄입니다)
        });

        // polyline 그리기
        const polyline = new window.naver.maps.Polyline({
          map,
          path: coords,
          strokeColor: "#1E90FF",
          strokeOpacity: 0.8,
          strokeWeight: 6,
        });
        polyRef.current = polyline;
      })
      .catch((err) => {
        console.error("ODsay 호출 오류:", err);
      });
  }, [map, start, end]);

  return null;
}
