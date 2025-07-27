// src/App.jsx
import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import UserInputForm from "./components/UserInputForm";
import MapLoader from "./components/MapLoader";
import MapView from "./components/MapView";
import DdarungiMarkers from "./components/DdarungiMarkers";
import IntegratedRoute from "./components/IntegratedRoute";
import { RouteContext } from "./context/RouteContext";
import { fetchAllStations } from "./utils/fetchAllStations";
import RouteSummary from "./components/RouteSummary";
import RouteList from "./components/RouteList";

const defaultCenter = { lat: 37.5866169, lng: 127.097436 };

export default function App() {
  const { startLocation, endLocation } = useContext(RouteContext);

  const [bikeTimeSec, setBikeTimeSec] = useState(900);
  const [mapInstance, setMapInstance] = useState(null);
  const [stations, setStations] = useState([]);
  const [showRoute, setShowRoute] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

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

  // 출발지나 도착지가 변경되면 기존 경로 정보를 초기화합니다.
  useEffect(() => {
    setShowRoute(false);
    setRoutes([]);
    setSelectedRouteIndex(0);
  }, [startLocation, endLocation]);

  const handleMapLoad = useCallback((map) => setMapInstance(map), []);

  // "경로 계산하기" 버튼 클릭 시 실행될 함수
  const handleCalculate = useCallback(() => {
    if (!startLocation || !endLocation || !mapInstance) {
      alert("출발·도착·지도를 모두 설정해 주세요.");
      return;
    }
    setBikeTimeSec(900); // 기본값 15분으로 초기화
    setRoutes([]);
    setSelectedRouteIndex(0);
    setShowRoute(true);
  }, [startLocation, endLocation, mapInstance]);

  return (
    <div className="flex h-screen">
      <aside className="w-1/3 bg-white p-8 shadow-lg overflow-auto">
        <h1 className="text-3xl font-bold mb-6">따릉이:Go</h1>

        <UserInputForm />

        <button
          onClick={handleCalculate}
          className="mt-6 w-full bg-blue-600 text-white py-3 text-lg rounded-lg hover:bg-blue-700 transition"
        >
          경로 계산하기
        </button>

        <RouteList
          routes={routes}
          selectedIndex={selectedRouteIndex}
          setSelectedRouteIndex={setSelectedRouteIndex}
        />
        <RouteSummary summary={routes[selectedRouteIndex]?.summary} />
      </aside>

      <div className="flex-1 h-full">
        <MapLoader>
          <MapView
            center={startLocation || defaultCenter}
            onMapLoad={handleMapLoad}
            className="w-full h-full"
          />
          <DdarungiMarkers
            map={mapInstance}
            center={startLocation || defaultCenter}
            stations={stations}
          />
          {showRoute && mapInstance && startLocation && endLocation && (
            <IntegratedRoute
              mapInstance={mapInstance}
              start={startLocation}
              end={endLocation}
              stations={stations}
              bikeTimeSec={bikeTimeSec}
              routes={routes}
              selectedIndex={selectedRouteIndex}
              setRoutes={setRoutes}
            />
          )}
        </MapLoader>
      </div>
    </div>
  );
}
