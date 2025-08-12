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
import { RouteContext } from "./context/RouteContext";
import { fetchAllStations } from "./utils/fetchAllStations";
import RouteSummary from "./components/RouteSummary";
import RouteList from "./components/RouteList";
import haversine from "./utils/haversine";
import { NEARBY_RADIUS_METERS } from "./utils/constants";

const defaultCenter = { lat: 37.5866169, lng: 127.097436 };

export default function App() {
  const {
    startLocation,
    endLocation,
    waypoints,
    setStartLocation,
  } = useContext(RouteContext);

  const { location: userLocation, error: locationError } = useCurrentLocation();

  const [bikeTimeSec, setBikeTimeSec] = useState(900);
  const [mapInstance, setMapInstance] = useState(null);
  const [stations, setStations] = useState([]);
  const [showRoute, setShowRoute] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [isMapCentered, setIsMapCentered] = useState(false);
  const [nearbyStats, setNearbyStats] = useState({
    stationCount: 0,
    bikeCount: 0,
  });
  const [statsCenter, setStatsCenter] = useState(null);

  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      setStatsCenter(userLocation);
      if (!startLocation) {
        setStartLocation(userLocation);
      }
    }
  }, [userLocation, startLocation, setStartLocation]);

  useEffect(() => {
    if (locationError) {
      console.error(locationError);
    }
  }, [locationError]);

  useEffect(() => {
    console.log("[startLocation,mapCenter] startLocation:", startLocation);
    console.log("[startLocation,mapCenter] mapCenter:", mapCenter);
    const newCenter = startLocation || mapCenter || null;
    setStatsCenter((prev) => {
      console.log("statsCenter before update:", prev);
      if (
        prev &&
        newCenter &&
        prev.lat === newCenter.lat &&
        prev.lng === newCenter.lng
      ) {
        console.log("statsCenter unchanged");
        return prev;
      }
      console.log("statsCenter after update:", newCenter);
      return newCenter;
    });
  }, [startLocation, mapCenter]);

  useEffect(() => {
    if (!mapInstance) return;
    const timer = setTimeout(() => {
      naver.maps.Event.trigger(mapInstance, "resize");
    }, 300);
    return () => clearTimeout(timer);
  }, [isSidebarOpen, mapInstance]);

  useEffect(() => {
    (async () => {
      try {
        const all = await fetchAllStations();
        setStations(all);
        console.log("🚲 대여소 총개수:", all.length);
      } catch (e) {
        console.error("따릉이 대여소 로딩 실패:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!statsCenter || stations.length === 0) return;
    console.log("[statsCenter] changed, recalculating:", statsCenter);

    const distances = stations.map((s) => ({
      ...s,
      dist: haversine(
        statsCenter.lat,
        statsCenter.lng,
        +s.stationLatitude,
        +s.stationLongitude
      ),
    }));
    console.log(
      "Distance list:",
      distances.map((s) => s.dist)
    );

    const nearby = distances.filter((s) => s.dist <= NEARBY_RADIUS_METERS);

    const stationCount = nearby.length;
    const bikeCount = nearby.reduce(
      (sum, s) => sum + Number(s.parkingBikeTotCnt),
      0
    );
    console.log("Calculated stats:", { stationCount, bikeCount });

    setNearbyStats({ stationCount, bikeCount });
  }, [statsCenter, stations]);

  // 출발지 또는 도착지가 처음 설정될 때 지도 중심을 이동시킵니다.
  useEffect(() => {
    if (!isMapCentered && (startLocation || endLocation)) {
      setMapCenter(startLocation || endLocation);
      setIsMapCentered(true);
    }
  }, [startLocation, endLocation, isMapCentered]);

  // 출발지·도착지·경유지가 변경되면 기존 경로 정보를 초기화합니다.
  useEffect(() => {
    setShowRoute(false);
    setRoutes([]);
    setSelectedRouteIndex(0);
  }, [startLocation, endLocation, waypoints]);

  const handleMapLoad = useCallback((map) => setMapInstance(map), []);

  // "경로 계산하기" 버튼 클릭 시 실행될 함수
  const handleCalculate = useCallback(() => {
    if (!startLocation || !endLocation || !mapInstance) {
      alert("출발·도착·지도를 모두 설정해 주세요.");
      return;
    }
    setIsCalculating(true);
    setBikeTimeSec(900); // 기본값 15분으로 초기화
    setRoutes([]);
    setSelectedRouteIndex(0);
    setShowRoute(true);
  }, [startLocation, endLocation, mapInstance]);

  return (
    <div className="flex h-screen relative">
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="reopen-sidebar absolute top-4 left-4 z-10 p-2 bg-white rounded shadow"
        >
          ☰
        </button>
      )}

      <aside
        className={`${
          isSidebarOpen
            ? "w-1/3 p-8 overflow-auto"
            : "w-0 p-0 overflow-hidden"
        } bg-white shadow-lg transition-all duration-300 relative`}
      >
        <button
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className="toggle-sidebar absolute top-4 right-4 p-2 bg-gray-200 rounded"
        >
          ✕
        </button>

        <p className="text-lg mb-4">
          근처 대여소 {nearbyStats.stationCount}곳 / 자전거 {nearbyStats.bikeCount}대
        </p>
        <h1 className="text-3xl font-bold mb-6">따릉이:Go</h1>

        <UserInputForm />

        <button
          onClick={handleCalculate}
          disabled={isCalculating}
          className="mt-6 w-full bg-blue-600 text-white py-3 text-lg rounded-lg hover:bg-blue-700 transition flex items-center justify-center disabled:opacity-50"
        >
          {isCalculating ? (
            <>
              <svg
                className="animate-spin h-5 w-5 mr-2 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              계산 중
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
              길찾기
            </>
          )}
        </button>

        <RouteList
          routes={routes}
          selectedIndex={selectedRouteIndex}
          setSelectedRouteIndex={setSelectedRouteIndex}
        />
        <RouteSummary summary={routes[selectedRouteIndex]?.summary} />
      </aside>

      <div className="flex-1 h-full transition-all duration-300">
        <MapLoader>
          <MapView
            center={mapCenter}
            onMapLoad={handleMapLoad}
            className="w-full h-full"
          />
          <DdarungiMarkers
            map={mapInstance}
            center={mapCenter}
            stations={stations}
          />
          {showRoute && mapInstance && startLocation && endLocation && (
            <IntegratedRoute
              mapInstance={mapInstance}
              start={startLocation}
              end={endLocation}
              waypoints={waypoints}
              stations={stations}
              bikeTimeSec={bikeTimeSec}
              routes={routes}
              selectedIndex={selectedRouteIndex}
              setRoutes={setRoutes}
              setIsCalculating={setIsCalculating}
            />
          )}
        </MapLoader>
      </div>
    </div>
  );
}
