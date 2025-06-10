/**
 * TMAP 보행자 경로안내 API를 호출하여 경로 데이터를 가져옵니다.
 * @param {object} start - 출발지 좌표 객체 {lat, lng}
 * @param {object} end - 도착지 좌표 객체 {lat, lng}
 * @returns {Promise<Array>} 네이버 지도 LatLng 객체로 변환된 좌표 배열
 */
export async function fetchTmapRoute(start, end) {
  // .env 파일에 저장된 TMAP API 키를 가져옵니다.
  const apiKey = import.meta.env.VITE_TMAP_API_KEY;
  const url = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        appKey: apiKey,
      },
      body: JSON.stringify({
        startX: start.lng.toString(),
        startY: start.lat.toString(),
        endX: end.lng.toString(),
        endY: end.lat.toString(),
        startName: "출발지",
        endName: "도착지",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`TMAP API Error: ${response.status} - ${errorBody.error.message}`);
    }

    const data = await response.json();

    // TMAP 응답에서 좌표 데이터만 추출하여 네이버 지도 형식으로 변환합니다.
    const coordinates = data.features.flatMap((feature) => {
      if (feature.geometry.type === "LineString") {
        return feature.geometry.coordinates.map(
          (coord) => new window.naver.maps.LatLng(coord[1], coord[0])
        );
      }
      return [];
    });

    return coordinates;

  } catch (error) {
    console.error("TMAP 경로 조회 중 에러 발생:", error);
    return []; // 에러 발생 시 빈 배열을 반환하여 앱이 멈추지 않도록 합니다.
  }
}