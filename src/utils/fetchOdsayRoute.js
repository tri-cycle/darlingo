// src/utils/fetchOdsayRoute.js
export async function fetchOdsayRoute(start, end) {
  const key = import.meta.env.VITE_ODSAY_API_KEY;
  const url = `https://api.odsay.com/v1/api/searchPubTransPath?SX=${start.x}&SY=${start.y}&EX=${end.x}&EY=${end.y}&apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("ODsay API 에러");
  return res.json();
}
