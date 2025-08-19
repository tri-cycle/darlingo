// src/utils/fetchOdsayRoute.js
export async function fetchOdsayRoute(
  start,
  end,
  via = null,
  options = {},
  retries = 3,
  delay = 1000
) {
  const key = import.meta.env.VITE_ODSAY_API_KEY;
  const params = new URLSearchParams({
    output: "json",
    lang: "0",
    SX: start.x,
    SY: start.y,
    EX: end.x,
    EY: end.y,
    apiKey: key,
    ...options,
  });
  if (via) {
    params.set("via", `${via.x},${via.y}`);
  }
  const url = `https://api.odsay.com/v1/api/searchPubTransPath?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    if ((res.status === 429 || res.status >= 500) && retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchOdsayRoute(start, end, via, options, retries - 1, delay * 2);
    }
    throw new Error(`ODsay HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    if (retries > 0 && [500, -98, -99].includes(data.error.code)) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchOdsayRoute(start, end, via, options, retries - 1, delay * 2);
    }
    throw new Error(`ODsay error ${data.error.code}: ${data.error.msg}`);
  }
  return data;
}
