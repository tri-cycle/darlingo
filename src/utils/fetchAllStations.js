/**
 * 모든 따릉이 대여소(약 2,600개)를 페이징으로 불러온다.
 * @returns {Promise<Array>} station 배열
 */
export async function fetchAllStations() {
  const pageSize = 1000;
  const maxRows = 3000;
  let all = [];

  for (let from = 1; from <= maxRows; from += pageSize) {
    const to = from + pageSize - 1;

    // ✨ Vercel Serverless Function을 통해 호출
    const url = `/api/getStations?from=${from}&to=${to}`;

    try {
      const res = await fetch(url);
      
      if (!res.ok) {
        console.error(`API 호출 실패: ${res.status}`);
        break;
      }

      const data = await res.json();
      const rows = data?.rentBikeStatus?.row || [];
      
      if (!rows.length) break;
      all = all.concat(rows);
    } catch (error) {
      console.error('대여소 데이터 로드 실패:', error);
      break;
    }
  }

  return all;
}