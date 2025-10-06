// src/components/LocationMarkers.jsx
import { useEffect, useRef } from "react";

const createMarkerIcon = (color, gradientColor, label, emoji) => `
  <div style="position: relative; width: 36px; height: 46px; display: flex; align-items: center; justify-content: center;">
    <svg viewBox="0 0 384 512" style="
      width: 100%; 
      height: 100%; 
      fill: url(#gradient-${label}); 
      stroke: #fff; 
      stroke-width: 6px; 
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2)) drop-shadow(0 1px 3px rgba(0,0,0,0.1));
    ">
      <defs>
        <linearGradient id="gradient-${label}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color}"/>
          <stop offset="100%" style="stop-color:${gradientColor}"/>
        </linearGradient>
      </defs>
      <path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0z"/>
    </svg>
    <div style="
      position: absolute; 
      top: 20%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      color: white; 
      font-size: 16px; 
      text-shadow: 0 1px 3px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      ${emoji}
    </div>
    <div style="
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, ${color}, ${gradientColor});
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: bold;
      white-space: nowrap;
      border: 1.5px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    ">
      ${label}
    </div>
  </div>
`;

export default function LocationMarkers({ map, start, end }) {
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);
  const currentInfoWindowRef = useRef(null);

  useEffect(() => {
    if (currentInfoWindowRef.current) {
      currentInfoWindowRef.current.close();
      currentInfoWindowRef.current = null;
    }

    // 출발지 마커
    if (startMarkerRef.current) {
      startMarkerRef.current.setMap(null);
    }
    if (map && start) {
      startMarkerRef.current = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(start.lat, start.lng),
        map,
        title: `출발지: ${start.name}`,
        icon: {
          content: createMarkerIcon("#34d399", "#059669", "출발", "🏁"),
          anchor: new window.naver.maps.Point(18, 46),
        },
        zIndex: 200,
      });

      const startInfoWindow = new window.naver.maps.InfoWindow({
        content: `
          <div style="
            padding: 14px;
            background: linear-gradient(135deg, #34d399, #059669);
            color: white;
            border-radius: 14px;
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.25);
            border: none;
            min-width: 180px;
          ">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="font-size: 16px;">🏁</span>
              <span style="font-weight: bold; font-size: 13px;">출발지</span>
            </div>
            <div style="font-size: 12px; opacity: 0.9; line-height: 1.4;">
              ${start.name}
            </div>
          </div>
        `,
        borderWidth: 0,
        backgroundColor: "transparent",
      });

      window.naver.maps.Event.addListener(startMarkerRef.current, "click", () => {
        if (currentInfoWindowRef.current) {
          currentInfoWindowRef.current.close();
        }
        startInfoWindow.open(map, startMarkerRef.current);
        currentInfoWindowRef.current = startInfoWindow;
      });
    }

    // 도착지 마커
    if (endMarkerRef.current) {
      endMarkerRef.current.setMap(null);
    }
    if (map && end) {
      endMarkerRef.current = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(end.lat, end.lng),
        map,
        title: `도착지: ${end.name}`,
        icon: {
          content: createMarkerIcon("#fbbf24", "#f59e0b", "도착", "🎯"),
          anchor: new window.naver.maps.Point(18, 46),
        },
        zIndex: 200,
      });

      const endInfoWindow = new window.naver.maps.InfoWindow({
        content: `
          <div style="
            padding: 14px;
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            color: white;
            border-radius: 14px;
            box-shadow: 0 6px 20px rgba(245, 158, 11, 0.25);
            border: none;
            min-width: 180px;
          ">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="font-size: 16px;">🎯</span>
              <span style="font-weight: bold; font-size: 13px;">도착지</span>
            </div>
            <div style="font-size: 12px; opacity: 0.9; line-height: 1.4;">
              ${end.name}
            </div>
          </div>
        `,
        borderWidth: 0,
        backgroundColor: "transparent",
      });

      window.naver.maps.Event.addListener(endMarkerRef.current, "click", () => {
        if (currentInfoWindowRef.current) {
          currentInfoWindowRef.current.close();
        }
        endInfoWindow.open(map, endMarkerRef.current);
        currentInfoWindowRef.current = endInfoWindow;
      });
    }

    // 지도 클릭 시 닫기
    const mapClickListener = map
      ? window.naver.maps.Event.addListener(map, "click", () => {
          if (currentInfoWindowRef.current) {
            currentInfoWindowRef.current.close();
            currentInfoWindowRef.current = null;
          }
        })
      : null;

    return () => {
      if (startMarkerRef.current) startMarkerRef.current.setMap(null);
      if (endMarkerRef.current) endMarkerRef.current.setMap(null);
      if (currentInfoWindowRef.current) {
        currentInfoWindowRef.current.close();
        currentInfoWindowRef.current = null;
      }
      if (mapClickListener) {
        window.naver.maps.Event.removeListener(mapClickListener);
      }
    };
  }, [map, start, end]);

  return null;
}
