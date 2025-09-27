// src/utils/fetchAllStations.js

/**
 * 모든 따릉이 대여소(약 2,600개)를 페이징으로 불러온다.
 * @returns {Promise<Array>} station 배열
 */
export async function fetchAllStations() {
  const pageSize = 1000;
  const maxRows  = 3000;
  let all = [];

  for (let from = 1; from <= maxRows; from += pageSize) {
    const to = from + pageSize - 1;

    try {
      // ✨ [핵심 수정] 외부 API 대신 우리 서버의 프록시 API(/api/getStations)를 호출합니다.
      const res = await fetch(`/api/getStations?from=${from}&to=${to}`);
      
      if (!res.ok) {
        // 우리 프록시 서버가 에러를 반환한 경우
        console.error(`Proxy request failed with status: ${res.status}`);
        continue; // 다음 페이지 시도
      }

      const data = await res.json();

      const rows = data?.rentBikeStatus?.row || [];
      if (!rows.length) {
        // 데이터가 없으면 루프 중단
        break;
      }
      
      all = all.concat(rows);

    } catch (error) {
      console.error(`Failed to fetch from proxy (from: ${from}, to: ${to}):`, error);
      continue;
    }
  }

  return all;
}
