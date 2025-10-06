// src/components/DdarungiMarkers.jsx
import { useEffect } from "react";
import useMarkers from "../hooks/useMarkers";
import haversine from "../utils/haversine";
import { NEARBY_RADIUS_METERS } from "../utils/constants";

export default function DdarungiMarkers({ map, center, stations }) {
  const setMarkers = useMarkers(map);

  useEffect(() => {
    if (!map || !center || !stations) {
      setMarkers([]);
      return;
    }

    const newMarkers = [];
    let currentInfoWindow = null; // 현재 열린 인포윈도우 추적

    stations.forEach((station) => {
      const lat = parseFloat(station.stationLatitude);
      const lng = parseFloat(station.stationLongitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const dist = haversine(center.lat, center.lng, lat, lng);

      if (dist <= NEARBY_RADIUS_METERS) {
        const bikeCount = Number(station.parkingBikeTotCnt) || 0;
        
        // 자전거 수량에 따른 색상 결정
        let bgColor, borderColor, textColor;
        if (bikeCount >= 5) {
          bgColor = '#10b981'; // emerald-500
          borderColor = '#059669'; // emerald-600
          textColor = '#ffffff';
        } else if (bikeCount >= 1) {
          bgColor = '#f59e0b'; // amber-500
          borderColor = '#d97706'; // amber-600
          textColor = '#ffffff';
        } else {
          bgColor = '#ef4444'; // red-500
          borderColor = '#dc2626'; // red-600
          textColor = '#ffffff';
        }

        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(lat, lng),
          title: `${station.stationName} (${bikeCount}대)`,
          icon: {
            content: `
              <div style="
                position: relative;
                width: 36px; 
                height: 36px; 
                background: linear-gradient(135deg, ${bgColor} 0%, ${borderColor} 100%);
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                color: ${textColor}; 
                font-size: 18px; 
                font-weight: bold; 
                border: 3px solid white; 
                box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
                cursor: pointer;
                transition: transform 0.2s ease;
              "
              onmouseover="this.style.transform='scale(1.1)'"
              onmouseout="this.style.transform='scale(1)'"
              >
                🚲
                <div style="
                  position: absolute;
                  top: -8px;
                  right: -8px;
                  background: ${borderColor};
                  color: white;
                  border-radius: 50%;
                  width: 18px;
                  height: 18px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 10px;
                  font-weight: bold;
                  border: 2px solid white;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                ">
                  ${bikeCount}
                </div>
              </div>
            `,
            anchor: new window.naver.maps.Point(18, 18),
          },
        });
        
        // 인포윈도우 추가
        const infoWindow = new window.naver.maps.InfoWindow({
          content: `
            <div style="
              padding: 12px 16px;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.15);
              border: none;
              min-width: 200px;
            ">
              <div style="
                font-weight: bold;
                font-size: 14px;
                color: #1f2937;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 6px;
              ">
                🚲 ${station.stationName}
              </div>
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
              ">
                <div style="
                  background: linear-gradient(135deg, #10b981, #059669);
                  color: white;
                  padding: 4px 8px;
                  border-radius: 8px;
                  font-size: 12px;
                  font-weight: bold;
                ">
                  이용가능: ${bikeCount}대
                </div>
                <div style="
                  background: #f3f4f6;
                  color: #6b7280;
                  padding: 4px 8px;
                  border-radius: 8px;
                  font-size: 12px;
                ">
                  총 ${station.rackTotCnt || 0}대
                </div>
              </div>
            </div>
          `,
          borderWidth: 0,
          backgroundColor: 'transparent',
        });

        // 클릭 이벤트
        window.naver.maps.Event.addListener(marker, 'click', () => {
          // 이전에 열린 인포윈도우가 있으면 닫기
          if (currentInfoWindow) {
            currentInfoWindow.close();
          }
          // 새 인포윈도우 열기
          infoWindow.open(map, marker);
          currentInfoWindow = infoWindow;
        });

        newMarkers.push(marker);
      }
    });

    // 지도 클릭 시 인포윈도우 닫기
    const mapClickListener = window.naver.maps.Event.addListener(map, 'click', () => {
      if (currentInfoWindow) {
        currentInfoWindow.close();
        currentInfoWindow = null;
      }
    });

    setMarkers(newMarkers);

    // 클린업 함수에서 이벤트 리스너 제거
    return () => {
      window.naver.maps.Event.removeListener(mapClickListener);
    };

  }, [map, center, stations, setMarkers]);

  return null;
}