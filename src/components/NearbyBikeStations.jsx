import React, { useEffect, useState } from "react";
import haversine from "../utils/haversine";
import { fetchAllStations } from "../utils/fetchAllStations";   // 🔸 추가

const NearbyBikeStations = ({ departureLat, departureLng }) => {
  const [stations, setStations] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    console.log("👀 NearbyBikeStations useEffect 실행");
    if (!departureLat || !departureLng) return;

    (async () => {
      try {
        /* ① 전체 대여소 2,600여 개 불러오기 */
        const allStations = await fetchAllStations();

        /* ② 100 m 이내 필터링 */
        const nearby = allStations.filter((s) => {
          const dist = haversine(
            departureLat,
            departureLng,
            +s.stationLatitude,
            +s.stationLongitude
          );
          return dist <= 100;
        });

        setStations(nearby);
        
        if (import.meta.env.DEV) {
          window.__nearbyStations = nearby;   // 🔸 디버깅용
        }
      } catch (err) {
        console.error("🚨 따릉이 대여소 불러오기 오류:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [departureLat, departureLng]);

  if (loading) return <p>대여소 정보를 불러오는 중...</p>;

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">🚲 100 m 이내 따릉이 대여소</h2>
      {stations.length > 0 ? (
        <ul className="list-disc pl-6 space-y-1">
          {stations.map((s) => (
            <li key={s.stationId}>
              {s.stationName.replace(/^\d+\.\s*/, "")} ({s.parkingBikeTotCnt}대)
            </li>
          ))}
        </ul>
      ) : (
        <p>근처에 대여소가 없습니다.</p>
      )}
    </div>
  );
};

export default NearbyBikeStations;
