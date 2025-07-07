// src/utils/fetchBikeRoute.js
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;

export async function fetchBikeRoute(from, to) {
  const res = await fetch(
    "https://api.openrouteservice.org/v2/directions/cycling-road/json",
    {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json; charset=utf-8",
      },
      // --- 수정된 부분 ---
      body: JSON.stringify({
        coordinates: [from, to],
        options: {
          // 계단을 피하는 옵션입니다.
          avoid_features: ["steps"],
          // 프로필별 세부 파라미터를 설정하는 부분입니다.
          profile_params: {
            // 경로의 가중치를 설정합니다.
            weightings: {
              // 가파른 언덕에 대한 난이도를 설정합니다. (0: 초보자, 3: 프로)
              // 0으로 설정하여 최대한 평평한 길을 선호하도록 합니다.
              steepness_difficulty: 0,
            }
          }
        }
      }),
      // --- 여기까지 수정 ---
    }
  );
  
  if (!res.ok) throw new Error(`ORS error ${res.status}: ${await res.text()}`);
  return res.json();
}