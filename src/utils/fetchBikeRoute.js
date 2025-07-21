// src/utils/fetchBikeRoute.js
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;

export async function fetchBikeRoute(from, to) {
  
  // --- ⬇️ (수정된 부분) ⬇️ ---
  // API 호출 직전에 어떤 값으로 요청하는지 콘솔에 출력합니다.
  console.log("🚀 ORS API 호출 시작:", { from, to });
  // --- ⬆️ (수정된 부분) ⬆️ ---

  const res = await fetch(
    "https://api.openrouteservice.org/v2/directions/cycling-road/json",
    {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        coordinates: [from, to],
        options: {
          avoid_features: ["steps"],
          profile_params: {
            weightings: {
              steepness_difficulty: 0,
            }
          }
        }
      }),
    }
  );
  
  if (!res.ok) throw new Error(`ORS error ${res.status}: ${await res.text()}`);

  const data = await res.json();

  // --- ⬇️ (수정된 부분) ⬇️ ---
  // API로부터 성공적으로 응답을 받았음을 콘솔에 출력합니다.
  console.log("✅ ORS API 응답 성공:", data.routes[0].summary);
  // --- ⬆️ (수정된 부분) ⬆️ ---
  
  return data;
}