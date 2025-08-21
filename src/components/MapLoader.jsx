// src/components/MapLoader.jsx
import { useEffect, useState } from "react";

export default function MapLoader({ children }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true; // 언마운트 후 setState 방지용

    /* ───────────── 1) 네이버 지도 로더 ───────────── */
    const loadNaver = () =>
      new Promise((resolve, reject) => {
        if (window.naver && window.naver.maps) return resolve(); // 이미 있음

        const base = "https://oapi.map.naver.com/openapi/v3/maps.js";
        const existing = document.querySelector(`script[src^="${base}"]`);
        if (existing) {
          existing.addEventListener("load", resolve);
          existing.addEventListener("error", reject);
          return;
        }

        const s = document.createElement("script");
        s.src = `${base}?ncpKeyId=${import.meta.env.VITE_NAVER_KEY_ID}`;
        s.async = true;
        s.defer = true;
        s.addEventListener("load", () => {
          console.log("✅ 네이버 지도 스크립트 로드 완료");
          resolve();
        });
        s.addEventListener("error", (e) => {
          console.error("❌ 네이버 지도 인증 실패", e);
          reject(e);
        });
        document.head.appendChild(s);
      });

    /* ───────────── 2) Google Maps 로더 ───────────── */
    const loadGoogle = () =>
      new Promise((resolve, reject) => {
        if (window.google && window.google.maps) return resolve(); // 이미 있음

        const base = "https://maps.googleapis.com/maps/api/js";
        const params =
          `key=${import.meta.env.VITE_GOOGLE_KEY}` +
          `&libraries=places` +
          `&callback=__initGoogle` +
          `&loading=async`;

        const existing = document.querySelector(`script[src^="${base}"]`);
        if (existing) {
          existing.addEventListener("load", resolve);
          existing.addEventListener("error", reject);
          return;
        }

        window.__initGoogle = () => {
          resolve();
          delete window.__initGoogle;
        };

        const s = document.createElement("script");
        s.src = `${base}?${params}`;
        s.async = true;
        s.defer = true;
        s.addEventListener("error", (e) => {
          console.error("❌ Google Maps 스크립트 로드 실패", e);
          reject(e);
        });
        document.head.appendChild(s);
      });

    /* ───────────── 3) 둘 다 로드될 때까지 대기 ───────────── */
    Promise.all([loadNaver(), loadGoogle()])
      .then(() => {
        if (alive) setLoaded(true);
      })
      .catch(console.error);

    return () => {
      alive = false; // clean-up
    };
  }, []);

  if (!loaded) return null; // 아직 로딩 중이면 아무것도 그리지 않음

  return <>{children}</>;
}
