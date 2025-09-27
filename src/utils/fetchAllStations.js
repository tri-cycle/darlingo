/**
 * 모든 따릉이 대여소(약 2 600개)를 페이징으로 불러온다.
 * @returns {Promise<Array>} station 배열
 */
export async function fetchAllStations() {
  const API_KEY = import.meta.env.VITE_SEOUL_API_KEY;      // 개인 키
  const pageSize = 1000;                                   // 한 번에 최대
  const maxRows  = 3000;                                   // 넉넉히

  let all = [];

  for (let from = 1; from <= maxRows; from += pageSize) {
    const to = from + pageSize - 1;   // ex) 1~1000, 1001~2000 …
 const url =
      `https://openapi.seoul.go.kr:8443/${API_KEY}/json/bikeList/` +
      `${from}/${to}/`;

    const res  = await fetch(url);
    const data = await res.json();
    // 오류나 마지막 페이지에서 'row'가 없으면 중단
    const rows = data?.rentBikeStatus?.row || [];
    if (!rows.length) break;

    all = all.concat(rows);
  }

  return all;
}
