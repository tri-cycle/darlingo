// src/utils/fetchOdsayRoute.js
export async function fetchOdsayRoute(start, end, vias = []) {
  const key = import.meta.env.VITE_ODSAY_API_KEY;
  let url = `https://api.odsay.com/v1/api/searchPubTransPath?SX=${start.x}&SY=${start.y}&EX=${end.x}&EY=${end.y}&apiKey=${key}`;
  if (vias.length > 0) {
    const viaParam = vias.map((v) => `${v.x},${v.y}`).join("|");
    url += `&via=${viaParam}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("ODsay API 에러");
  return res.json();
}
