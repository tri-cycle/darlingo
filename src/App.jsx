// src/App.jsx
import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import useCurrentLocation from "./hooks/useCurrentLocation";
import UserInputForm from "./components/UserInputForm";
import MapLoader from "./components/MapLoader";
import MapView from "./components/MapView";
import DdarungiMarkers from "./components/DdarungiMarkers";
import IntegratedRoute from "./components/IntegratedRoute";
import RouteStationMarkers from "./components/RouteStationMarkers";
import LocationMarkers from "./components/LocationMarkers";
import { RouteContext } from "./context/RouteContext";
import { fetchAllStations } from "./utils/fetchAllStations";
import RouteSummary from "./components/RouteSummary";
import RouteList from "./components/RouteList";
import haversine from "./utils/haversine";
import { NEARBY_RADIUS_METERS } from "./utils/constants";
import { calculateCombinedRoutes } from "./utils/routeCalculator";

const defaultCenter = { lat: 37.5665, lng: 126.9780 };

// 거리에 따라 적절한 줌 레벨을 반환하는 함수
function getZoomLevelForDistance(distance) {
  if (distance > 40000) return 10;
  if (distance > 20000) return 11;
  if (distance > 10000) return 12;
  if (distance > 5000) return 13;
  if (distance > 2500) return 14;
  if (distance > 1200) return 15;
  return 15; // 1.2km 미만
}

function updateMapCenterAndZoom(map, start, end) {
  const hasStart = start?.lat && start?.lng;
  const hasEnd = end?.lat && end?.lng;
  let center = null;

  if (hasStart && hasEnd) {
    center = {
      lat: (start.lat + end.lat) / 2,
      lng: (start.lng + end.lng) / 2,
    };
    map.setCenter(new window.naver.maps.LatLng(center.lat, center.lng));
    const distance = haversine(start.lat, start.lng, end.lat, end.lng);
    map.setZoom(getZoomLevelForDistance(distance));
  } else if (hasStart) {
    center = { lat: start.lat, lng: start.lng };
    map.setCenter(new window.naver.maps.LatLng(center.lat, center.lng));
    map.setZoom(15);
  } else if (hasEnd) {
    center = { lat: end.lat, lng: end.lng };
    map.setCenter(new window.naver.maps.LatLng(center.lat, center.lng));
    map.setZoom(15);
  }

  return center;
}

export default function App() {
  const { startLocation, endLocation, waypoints, setStartLocation } = useContext(RouteContext);
  const { location: userLocation, error: locationError } = useCurrentLocation();
  const [mapInstance, setMapInstance] = useState(null);
  const [stations, setStations] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [statsCenter, setStatsCenter] = useState(null);
  const [nearbyStats, setNearbyStats] = useState({ stationCount: 0, bikeCount: 0 });
  const [initialLocationSet, setInitialLocationSet] = useState(false);

  useEffect(() => {
    if (userLocation && !initialLocationSet) {
      const newLocation = { lat: userLocation.lat, lng: userLocation.lng, name: "현재 위치" };
      if (!startLocation) {
        setStartLocation(newLocation);
      }
      setInitialLocationSet(true);
    }
  }, [userLocation, startLocation, initialLocationSet, setStartLocation]);

  useEffect(() => {
    if (!mapInstance) return;
    if (!startLocation && !endLocation) return;

    const center = updateMapCenterAndZoom(mapInstance, startLocation, endLocation);
    if (center) setMapCenter(center);
    setStatsCenter(startLocation ?? null);
  }, [startLocation, endLocation, mapInstance]);

  useEffect(() => { if (locationError) console.error(locationError); }, [locationError]);

  useEffect(() => {
    if (!mapInstance) return;
    const timer = setTimeout(() => window.naver.maps.Event.trigger(mapInstance, "resize"), 300);
    return () => clearTimeout(timer);
  }, [isSidebarOpen, mapInstance]);

  useEffect(() => {
    (async () => {
      try {
        const all = await fetchAllStations();
        setStations(all);
      } catch (e) { console.error("따릉이 대여소 로딩 실패:", e); }
    })();
  }, []);

  useEffect(() => {
    if (!statsCenter || stations.length === 0) {
      setNearbyStats({ stationCount: 0, bikeCount: 0 });
      return;
    }
    const nearby = stations.filter((s) => haversine(statsCenter.lat, statsCenter.lng, +s.stationLatitude, +s.stationLongitude) <= NEARBY_RADIUS_METERS);
    const bikeCount = nearby.reduce((sum, s) => sum + Number(s.parkingBikeTotCnt), 0);
    setNearbyStats({ stationCount: nearby.length, bikeCount });
  }, [statsCenter, stations]);

  useEffect(() => {
    setRoutes([]);
    setSelectedRouteIndex(0);
  }, [startLocation, endLocation, waypoints]);

  const handleMapLoad = useCallback((map) => { setMapInstance(map); }, []);

  const handleCalculate = useCallback(async () => {
    if (!startLocation || !endLocation || !mapInstance) {
      alert("출발지와 도착지를 모두 설정해주세요.");
      return;
    }
    setIsCalculating(true);
    setRoutes([]);
    setSelectedRouteIndex(0);
    const calculatedRoutes = await calculateCombinedRoutes({ start: startLocation, end: endLocation, waypoints, stations });
    setRoutes(calculatedRoutes);
    setIsCalculating(false);
  }, [startLocation, endLocation, mapInstance, waypoints, stations]);

  return (
    <div className="flex h-screen relative bg-gradient-to-br from-gray-50 to-blue-50">
      {/* 햄버거 메뉴 버튼 - 사이드바가 닫혀있을 때만 표시 */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)} 
          className="absolute top-6 left-6 z-20 p-4 bg-white rounded-2xl shadow-xl border border-gray-100 hover:bg-gray-50 hover:shadow-2xl transition-all duration-300 group backdrop-blur-sm"
        >
          <svg className="w-6 h-6 text-gray-700 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* 사이드바 */}
      <aside className={`${
        isSidebarOpen ? "w-[420px]" : "w-0"
      } bg-white/95 backdrop-blur-lg shadow-2xl transition-all duration-300 ease-in-out relative z-10 overflow-hidden border-r border-white/20`}>
        <div className="h-full flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-8 border-b border-gray-100/50 bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse"></div>
            <div className="flex items-center space-x-4 relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3.1 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">따릉이GO</h1>
                <p className="text-white/80 text-sm">스마트 자전거 길찾기</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-all duration-200 backdrop-blur-sm border border-white/30 relative z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 통계 카드 */}
          <div className="p-8 border-b border-gray-100/50 bg-gradient-to-br from-slate-50/50 to-blue-50/50 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 group">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">{nearbyStats.stationCount}</p>
                    <p className="text-sm text-gray-600 font-medium">근처 대여소</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 group">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3.1 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors duration-300">{nearbyStats.bikeCount}</p>
                    <p className="text-sm text-gray-600 font-medium">이용가능 자전거</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 스크롤 가능한 컨텐츠 영역 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-8 space-y-8">
              {/* 입력 폼 */}
              <div className="space-y-6">
                <UserInputForm />
                
                {/* 길찾기 버튼 */}
                <button 
                  onClick={handleCalculate} 
                  disabled={isCalculating || !startLocation || !endLocation}
                  className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 text-white py-5 px-8 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-3 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  {isCalculating ? (
                    <>
                      <svg className="animate-spin w-6 h-6 relative z-10" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="relative z-10">경로 계산 중...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="relative z-10">길찾기 시작</span>
                    </>
                  )}
                </button>
              </div>

              {/* 경로 목록 */}
              {routes.length > 0 && (
                <div className="space-y-6">
                  <RouteList 
                    routes={routes} 
                    selectedIndex={selectedRouteIndex} 
                    setSelectedRouteIndex={setSelectedRouteIndex} 
                  />
                  <RouteSummary summary={routes[selectedRouteIndex]?.summary} />
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* 지도 영역 */}
      <div className="flex-1 h-full relative">
        <MapLoader>
          <MapView center={mapCenter} onMapLoad={handleMapLoad} className="w-full h-full rounded-l-3xl overflow-hidden shadow-2xl" />
          <LocationMarkers map={mapInstance} start={startLocation} end={endLocation} />
          {routes.length === 0 ? (
            <DdarungiMarkers map={mapInstance} center={statsCenter} stations={stations} />
          ) : (
            <>
              <IntegratedRoute mapInstance={mapInstance} routes={routes} selectedIndex={selectedRouteIndex} />
              <RouteStationMarkers map={mapInstance} selectedRoute={routes[selectedRouteIndex]} allStations={stations} />
            </>
          )}
        </MapLoader>
      </div>
    </div>
  );
}