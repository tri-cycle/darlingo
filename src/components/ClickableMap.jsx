// src/components/ClickableMap.jsx
import { useEffect, useRef, useContext } from 'react';
import { RouteContext } from '../context/RouteContext';
import useMarkers from '../hooks/useMarkers';
import haversine from '../utils/haversine';

const NEARBY_RADIUS_METERS = 500; // 클릭 지점 주변 500m 반경

export default function ClickableMap({ map, stations }) {
  const { setStartLocation, setEndLocation } = useContext(RouteContext);
  const clickMarkerRef = useRef(null);
  const clickInfoWindowRef = useRef(null);
  const setNearbyMarkers = useMarkers(map);
  const mapClickListenerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    // 기존 리스너 제거
    if (mapClickListenerRef.current) {
      window.naver.maps.Event.removeListener(mapClickListenerRef.current);
    }

    // 지도 클릭 이벤트 등록
    mapClickListenerRef.current = window.naver.maps.Event.addListener(map, 'click', async (e) => {
      const latlng = e.latlng || e.coord;
      const lat = latlng.lat();
      const lng = latlng.lng();

      // Google Geocoding API로 주소 가져오기
      let placeName = '선택한 위치';
      let fullAddress = '';
      
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=ko`
        );
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            // 첫 번째 결과의 formatted_address 사용
            fullAddress = data.results[0].formatted_address;
            
            // "대한민국" 제거하고 전체 주소를 표시명으로 사용
            placeName = fullAddress.replace('대한민국', '').trim();
            
            // 쉼표가 있으면 제거
            placeName = placeName.replace(/,/g, '');
          }
        }
      } catch (error) {
        console.error('주소 조회 실패:', error);
        placeName = '선택한 위치';
        fullAddress = `위도: ${lat.toFixed(6)}, 경도: ${lng.toFixed(6)}`;
      }

      // 기존 클릭 마커 제거
      if (clickMarkerRef.current) {
        clickMarkerRef.current.setMap(null);
      }
      if (clickInfoWindowRef.current) {
        clickInfoWindowRef.current.close();
      }

      // 새 마커 생성
      const marker = new window.naver.maps.Marker({
        position: latlng,
        map: map,
        icon: {
          content: `
            <div style="
              position: relative;
              width: 40px;
              height: 50px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg viewBox="0 0 384 512" style="
                width: 100%;
                height: 100%;
                fill: url(#gradient-click);
                stroke: #fff;
                stroke-width: 6px;
                filter: drop-shadow(0 6px 12px rgba(0,0,0,0.3));
              ">
                <defs>
                  <linearGradient id="gradient-click" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#3b82f6"/>
                    <stop offset="100%" style="stop-color:#1d4ed8"/>
                  </linearGradient>
                </defs>
                <path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0z"/>
              </svg>
              <div style="
                position: absolute;
                top: 25%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 18px;
              ">
                📍
              </div>
            </div>
          `,
          anchor: new window.naver.maps.Point(20, 50),
        },
        zIndex: 300,
      });

      clickMarkerRef.current = marker;

      // 인포윈도우 생성
      const infoWindow = new window.naver.maps.InfoWindow({
        content: `
          <div style="
            padding: 16px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            border: none;
            min-width: 250px;
            max-width: 320px;
            position: relative;
          ">
            <!-- 닫기 버튼 -->
            <button 
              id="close-info-btn"
              style="
                position: absolute;
                top: 12px;
                right: 12px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #f3f4f6;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                z-index: 10;
              "
              onmouseover="this.style.background='#e5e7eb'"
              onmouseout="this.style.background='#f3f4f6'"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round">
                <path d="M2 2L10 10M2 10L10 2"/>
              </svg>
            </button>

            <div style="
              font-size: 13px;
              color: #1f2937;
              margin-bottom: 12px;
              line-height: 1.5;
              word-break: keep-all;
              display: flex;
              align-items: flex-start;
              gap: 6px;
              padding-right: 20px;
            ">
              <span style="font-size: 16px; flex-shrink: 0;">📍</span>
              <span style="font-weight: 600;">${placeName}</span>
            </div>
            <div style="
              display: flex;
              gap: 8px;
            ">
              <button 
                id="set-start-btn"
                style="
                  flex: 1;
                  background: linear-gradient(135deg, #10b981, #059669);
                  color: white;
                  border: none;
                  padding: 8px 12px;
                  border-radius: 10px;
                  font-size: 12px;
                  font-weight: bold;
                  cursor: pointer;
                  transition: all 0.2s;
                "
                onmouseover="this.style.transform='scale(1.05)'"
                onmouseout="this.style.transform='scale(1)'"
              >
                🏁 출발지 설정
              </button>
              <button 
                id="set-end-btn"
                style="
                  flex: 1;
                  background: linear-gradient(135deg, #f59e0b, #d97706);
                  color: white;
                  border: none;
                  padding: 8px 12px;
                  border-radius: 10px;
                  font-size: 12px;
                  font-weight: bold;
                  cursor: pointer;
                  transition: all 0.2s;
                "
                onmouseover="this.style.transform='scale(1.05)'"
                onmouseout="this.style.transform='scale(1)'"
              >
                🎯 도착지 설정
              </button>
            </div>
          </div>
        `,
        borderWidth: 0,
        backgroundColor: 'transparent',
        disableAnchor: true,
        pixelOffset: new window.naver.maps.Point(0, -10),
      });

      clickInfoWindowRef.current = infoWindow;
      infoWindow.open(map, marker);

      // 버튼 이벤트 등록
      setTimeout(() => {
        const closeBtn = document.getElementById('close-info-btn');
        const startBtn = document.getElementById('set-start-btn');
        const endBtn = document.getElementById('set-end-btn');

        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            infoWindow.close();
            marker.setMap(null);
            setNearbyMarkers([]);
          });
        }

        if (startBtn) {
          startBtn.addEventListener('click', () => {
            setStartLocation({ 
              lat, 
              lng, 
              name: placeName
            });
            infoWindow.close();
            marker.setMap(null);
            setNearbyMarkers([]);
          });
        }

        if (endBtn) {
          endBtn.addEventListener('click', () => {
            setEndLocation({ 
              lat, 
              lng, 
              name: placeName
            });
            infoWindow.close();
            marker.setMap(null);
            setNearbyMarkers([]);
          });
        }
      }, 100);

      clickInfoWindowRef.current = infoWindow;
      infoWindow.open(map, marker);

      // 버튼 이벤트 등록
      setTimeout(() => {
        const startBtn = document.getElementById('set-start-btn');
        const endBtn = document.getElementById('set-end-btn');

        if (startBtn) {
          startBtn.addEventListener('click', () => {
            setStartLocation({ 
              lat, 
              lng, 
              name: placeName
            });
            infoWindow.close();
            marker.setMap(null);
            setNearbyMarkers([]);
          });
        }

        if (endBtn) {
          endBtn.addEventListener('click', () => {
            setEndLocation({ 
              lat, 
              lng, 
              name: placeName
            });
            infoWindow.close();
            marker.setMap(null);
            setNearbyMarkers([]);
          });
        }
      }, 100);

      // 주변 따릉이 대여소 표시
      if (stations && stations.length > 0) {
        const nearbyStations = stations.filter(station => {
          const stationLat = parseFloat(station.stationLatitude);
          const stationLng = parseFloat(station.stationLongitude);
          if (isNaN(stationLat) || isNaN(stationLng)) return false;
          
          const distance = haversine(lat, lng, stationLat, stationLng);
          return distance <= NEARBY_RADIUS_METERS;
        });

        // 주변 대여소 통계 계산
        const nearbyStationCount = nearbyStations.length;
        const nearbyBikeCount = nearbyStations.reduce((sum, s) => sum + (Number(s.parkingBikeTotCnt) || 0), 0);

        const markers = nearbyStations.map(station => {
          const stationLat = parseFloat(station.stationLatitude);
          const stationLng = parseFloat(station.stationLongitude);
          const bikeCount = Number(station.parkingBikeTotCnt) || 0;

          let bgColor, borderColor;
          if (bikeCount >= 5) {
            bgColor = '#10b981';
            borderColor = '#059669';
          } else if (bikeCount >= 1) {
            bgColor = '#f59e0b';
            borderColor = '#d97706';
          } else {
            bgColor = '#ef4444';
            borderColor = '#dc2626';
          }

          const stationMarker = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(stationLat, stationLng),
            map: map,
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
                  color: white;
                  font-size: 18px;
                  font-weight: bold;
                  border: 3px solid white;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                  cursor: pointer;
                  transition: transform 0.2s ease;
                "
                onmouseover="this.style.transform='scale(1.15)'"
                onmouseout="this.style.transform='scale(1)'"
                >
                  🚲
                  <div style="
                    position: absolute;
                    top: -6px;
                    right: -6px;
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
            zIndex: 250,
          });

          const stationInfoWindow = new window.naver.maps.InfoWindow({
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
                  font-size: 13px;
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

          window.naver.maps.Event.addListener(stationMarker, 'click', () => {
            stationInfoWindow.open(map, stationMarker);
          });

          return stationMarker;
        });

        setNearbyMarkers(markers);

        // 인포윈도우 내용 업데이트 (통계 포함)
        const infoWindowContent = `
          <div style="
            padding: 16px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            border: none;
            min-width: 250px;
            max-width: 320px;
            position: relative;
          ">
            <!-- 닫기 버튼 -->
            <button 
              id="close-info-btn"
              style="
                position: absolute;
                top: 12px;
                right: 12px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #f3f4f6;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                z-index: 10;
              "
              onmouseover="this.style.background='#e5e7eb'"
              onmouseout="this.style.background='#f3f4f6'"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round">
                <path d="M2 2L10 10M2 10L10 2"/>
              </svg>
            </button>

            <div style="
              font-size: 13px;
              color: #1f2937;
              margin-bottom: 8px;
              line-height: 1.5;
              word-break: keep-all;
              display: flex;
              align-items: flex-start;
              gap: 6px;
              padding-right: 20px;
            ">
              <span style="font-size: 16px; flex-shrink: 0;">📍</span>
              <span style="font-weight: 600;">${placeName}</span>
            </div>
            
            <!-- 주변 대여소 통계 -->
            <div style="
              background: linear-gradient(135deg, #eff6ff, #dbeafe);
              padding: 10px 12px;
              border-radius: 10px;
              margin-bottom: 12px;
              border: 1px solid #bfdbfe;
            ">
              <div style="
                display: flex;
                justify-content: space-around;
                gap: 12px;
              ">
                <div style="text-align: center;">
                  <div style="
                    font-size: 20px;
                    font-weight: bold;
                    color: #2563eb;
                  ">${nearbyStationCount}</div>
                  <div style="
                    font-size: 11px;
                    color: #64748b;
                    margin-top: 2px;
                  ">근처 대여소</div>
                </div>
                <div style="
                  width: 1px;
                  background: #cbd5e1;
                "></div>
                <div style="text-align: center;">
                  <div style="
                    font-size: 20px;
                    font-weight: bold;
                    color: #10b981;
                  ">${nearbyBikeCount}</div>
                  <div style="
                    font-size: 11px;
                    color: #64748b;
                    margin-top: 2px;
                  ">이용가능 자전거</div>
                </div>
              </div>
            </div>
            
            <div style="
              display: flex;
              gap: 8px;
            ">
              <button 
                id="set-start-btn"
                style="
                  flex: 1;
                  background: linear-gradient(135deg, #10b981, #059669);
                  color: white;
                  border: none;
                  padding: 8px 12px;
                  border-radius: 10px;
                  font-size: 12px;
                  font-weight: bold;
                  cursor: pointer;
                  transition: all 0.2s;
                "
                onmouseover="this.style.transform='scale(1.05)'"
                onmouseout="this.style.transform='scale(1)'"
              >
                🏁 출발지 설정
              </button>
              <button 
                id="set-end-btn"
                style="
                  flex: 1;
                  background: linear-gradient(135deg, #f59e0b, #d97706);
                  color: white;
                  border: none;
                  padding: 8px 12px;
                  border-radius: 10px;
                  font-size: 12px;
                  font-weight: bold;
                  cursor: pointer;
                  transition: all 0.2s;
                "
                onmouseover="this.style.transform='scale(1.05)'"
                onmouseout="this.style.transform='scale(1)'"
              >
                🎯 도착지 설정
              </button>
            </div>
          </div>
        `;

        infoWindow.setContent(infoWindowContent);
      }
    });

    return () => {
      if (mapClickListenerRef.current) {
        window.naver.maps.Event.removeListener(mapClickListenerRef.current);
      }
      if (clickMarkerRef.current) {
        clickMarkerRef.current.setMap(null);
      }
      if (clickInfoWindowRef.current) {
        clickInfoWindowRef.current.close();
      }
      setNearbyMarkers([]);
    };
  }, [map, stations, setStartLocation, setEndLocation, setNearbyMarkers]);

  return null;
}