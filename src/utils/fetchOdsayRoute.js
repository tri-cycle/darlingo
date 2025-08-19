// src/utils/fetchOdsayRoute.js
export async function fetchOdsayRoute(start, end, via = null, retries = 1) {
  const key = import.meta.env.VITE_ODSAY_API_KEY;
  let url =
    `https://api.odsay.com/v1/api/searchPubTransPath?output=json&lang=0&SX=${start.x}&SY=${start.y}&EX=${end.x}&EY=${end.y}&apiKey=${key}`;
  if (via) {
    url += `&via=${via.x},${via.y}`;
  }
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status >= 500 && retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchOdsayRoute(start, end, via, retries - 1);
    }
    throw new Error(`ODsay HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    if (retries > 0 && [500, -98, -99].includes(data.error.code)) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchOdsayRoute(start, end, via, retries - 1);
    }
    throw new Error(`ODsay error ${data.error.code}: ${data.error.msg}`);
  }
  return data;
}
