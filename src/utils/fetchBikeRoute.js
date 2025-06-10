// src/utils/fetchBikeRoute.js
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;

export async function fetchBikeRoute(from, to) {
  const res = await fetch(
    "https://api.openrouteservice.org/v2/directions/cycling-regular/json",
    {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ coordinates: [from, to] }),
    }
  );
  if (!res.ok) throw new Error(`ORS error ${res.status}: ${await res.text()}`);
  return res.json();
}
