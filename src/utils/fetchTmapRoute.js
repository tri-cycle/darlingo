/**
 * TMAP 보행자 경로안내 API를 호출하여 경로 데이터를 가져옵니다.
 * @param {object} start - 출발지 좌표 객체 {lat, lng}
 * @param {object} end - 도착지 좌표 객체 {lat, lng}
 * @param {Array} vias - 경유지 배열 [{lat, lng}, ...]
 * @returns {Promise<Array>} 네이버 지도 LatLng 객체로 변환된 좌표 배열
 */
export async function fetchTmapRoute(start, end, vias = []) {
  const apiKey = import.meta.env.VITE_TMAP_API_KEY;
  const url = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1";

  function haversineDistance(a, b) {
    const R = 6371000;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  if (haversineDistance(start, end) < 100) {
    console.warn("출발지와 도착지가 너무 가까워 TMAP API 호출 생략");
    return [];
  }

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
        reqCoordType: "WGS84GEO",
        resCoordType: "WGS84GEO",
        ...(vias.length > 0 && {
          passList: vias.map(v => `${v.lng},${v.lat}`).join("_"),
        }),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`TMAP API Error: ${response.status} - ${errorBody.error.message}`);
    }

    const data = await response.json();

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
    return [];
  }
}
