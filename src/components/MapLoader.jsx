// src/components/MapLoader.jsx
import { useEffect, useState } from "react";

function loadScript({ src, callback, async = true, defer = true, onLoad, onError }) {
  return new Promise((resolve, reject) => {
    const base = src.split("?")[0];
    let script = document.querySelector(`script[src^="${base}"]`);

    const finish = () => {
      script?.setAttribute("data-loaded", "true");
      onLoad?.();
      resolve();
    };

    if (script) {
      const loaded = script.readyState === "complete" || script.dataset.loaded === "true";
      if (loaded) {
        finish();
        return;
      }

      if (!callback) script.addEventListener("load", finish);
      script.addEventListener("error", (e) => {
        onError?.(e);
        reject(e);
      });
    } else {
      script = document.createElement("script");
      script.src = src;
      if (async) script.async = true;
      if (defer) script.defer = true;
      if (!callback) script.addEventListener("load", finish);
      script.addEventListener("error", (e) => {
        onError?.(e);
        reject(e);
      });
      document.head.appendChild(script);
    }

    if (callback) {
      window[callback] = () => {
        finish();
        delete window[callback];
      };
    }
  });
}

export default function MapLoader({ children }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true; // 언마운트 후 setState 방지용

    /* ───────────── 1) 네이버 지도 로더 ───────────── */
    const loadNaver = () => {
      if (window.naver && window.naver.maps) return Promise.resolve();
      const src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${import.meta.env.VITE_NAVER_KEY_ID}`;
      return loadScript({ src });
    };

    /* ───────────── 2) Google Maps 로더 ───────────── */
    const loadGoogle = () => {
      if (window.google && window.google.maps) return Promise.resolve();
      const callback = "__initGoogle";
      const src =
        "https://maps.googleapis.com/maps/api/js?" +
        `key=${import.meta.env.VITE_GOOGLE_KEY}` +
        `&libraries=places` +
        `&callback=${callback}` +
        `&loading=async`;
      return loadScript({ src, callback });
    };

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
