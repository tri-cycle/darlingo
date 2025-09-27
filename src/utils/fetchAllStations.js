/**
 * 모든 따릉이 대여소(약 2,600개)를 페이징으로 불러온다.
 * @returns {Promise<Array>} station 배열
 */
export async function fetchAllStations() {
  const API_KEY = import.meta.env.VITE_SEOUL_API_KEY;      // 개인 키
  const pageSize = 1000;                                   // 한 번에 최대
  const maxRows  = 3000;                                   // 넉넉히

  let all = [];

  for (let from = 1; from <= maxRows; from += pageSize) {
    const to = from + pageSize - 1;   // ex) 1~1000, 1001~2000 …

    // ✨ [핵심 수정] https 프로토콜과 기본 포트(생략 가능)를 사용하는 주소로 변경
    const url =
      `https://openapi.seoul.go.kr:443/${API_KEY}/json/bikeList/${from}/${to}/`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      // 오류나 마지막 페이지에서 'row'가 없으면 중단
      const rows = data?.rentBikeStatus?.row || [];
      if (!rows.length) break;

      all = all.concat(rows);
    } catch (error) {
      console.error(`API 요청 실패 (from: ${from}, to: ${to}):`, error);
      // 특정 페이지에서 실패하더라도 다음 페이지는 시도하도록 continue 추가
      continue; 
    }
  }

  return all;
}
