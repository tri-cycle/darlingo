// src/utils/fetchBikeRoute.js
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;

export async function fetchBikeRoute(from, to) {
  // --- 수정된 부분 ---
  // 기존 "cycling-regular"는 최단 거리를 우선하여 골목길을 포함할 수 있습니다.
  // "cycling-road" 프로필로 변경하여, 포장된 큰 도로와 자전거 도로를 우선하도록 합니다.
  // 이렇게 하면 더 쾌적하고 예측 가능한 자전거 경로를 얻을 수 있습니다.
  const res = await fetch(
    "https://api.openrouteservice.org/v2/directions/cycling-road/json", // "cycling-regular"에서 "cycling-road"로 변경
    {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ coordinates: [from, to] }),
    }
  );
  // --- 여기까지 수정 ---
  
  if (!res.ok) throw new Error(`ORS error ${res.status}: ${await res.text()}`);
  return res.json();
}