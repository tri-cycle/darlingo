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
    <div className="flex h-screen relative">
      {!isSidebarOpen && 
        <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 z-10 p-2 bg-white rounded shadow">
          ☰
        </button>
      }
      <aside className={`${isSidebarOpen ? "w-1/3 p-8 overflow-auto" : "w-0 p-0 overflow-hidden"} bg-white shadow-lg transition-all duration-300 relative`}>
        <button onClick={() => setIsSidebarOpen((prev) => !prev)} className="absolute top-4 right-4 p-2 bg-gray-200 rounded">✕</button>
        <p className="text-lg mb-4">근처 대여소 {nearbyStats.stationCount}곳 / 자전거 {nearbyStats.bikeCount}대</p>
        <h1 className="text-3xl font-bold mb-6">따릉이:Go</h1>
        <UserInputForm />
        <button onClick={handleCalculate} disabled={isCalculating} className="mt-6 w-full bg-blue-600 text-white py-3 text-lg rounded-lg hover:bg-blue-700 transition flex items-center justify-center disabled:opacity-50">
          {isCalculating ? '계산 중...' : '길찾기'}
        </button>
        <RouteList routes={routes} selectedIndex={selectedRouteIndex} setSelectedRouteIndex={setSelectedRouteIndex} />
        <RouteSummary summary={routes[selectedRouteIndex]?.summary} />
      </aside>
      <div className="flex-1 h-full">
        <MapLoader>
          <MapView center={mapCenter} onMapLoad={handleMapLoad} className="w-full h-full" />
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