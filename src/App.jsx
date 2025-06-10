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
// [추가 1] 새로 만든 RouteSummary 컴포넌트를 가져옵니다.
import RouteSummary from "./components/RouteSummary";

const defaultCenter = { lat: 37.5866169, lng: 127.097436 };

export default function App() {
  const { startLocation, endLocation } = useContext(RouteContext);

  const [bikeTimeSec, setBikeTimeSec] = useState(900);
  const [mapInstance, setMapInstance] = useState(null);
  const [stations, setStations] = useState([]);
  const [showRoute, setShowRoute] = useState(false);
  // [추가 2] 경로 요약 정보를 저장할 상태를 만듭니다. 초기값은 null입니다.
  const [routeSummary, setRouteSummary] = useState(null);

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

  // 출발/도착지가 바뀌면 기존 경로와 요약 정보를 숨깁니다.
  useEffect(() => {
    setShowRoute(false);
    setRouteSummary(null);
  }, [startLocation, endLocation]);

  const handleMapLoad = useCallback((map) => setMapInstance(map), []);

  // "경로 계산하기" 버튼 클릭 시 실행될 함수
  const handleCalculate = useCallback(() => {
    if (!startLocation || !endLocation || !mapInstance) {
      alert("출발·도착·지도를 모두 설정해 주세요.");
      return;
    }
    // [수정 1] 새로운 계산을 시작하기 전에 이전 요약 정보를 초기화합니다.
    setRouteSummary(null);
    setShowRoute(true);
  }, [startLocation, endLocation, mapInstance]);

  return (
    <div className="flex h-screen">
      <aside className="w-1/3 bg-white p-8 shadow-lg overflow-auto">
        <h1 className="text-3xl font-bold mb-6">따릉이:Go</h1>

        <UserInputForm
          bikeTimeSec={bikeTimeSec}
          setBikeTimeSec={setBikeTimeSec}
        />

        <button
          onClick={handleCalculate}
          className="mt-6 w-full bg-blue-600 text-white py-3 text-lg rounded-lg hover:bg-blue-700 transition"
        >
          경로 계산하기
        </button>

        {/* [추가 3] routeSummary 상태에 정보가 있을 때만 요약 컴포넌트를 보여줍니다. */}
        <RouteSummary summary={routeSummary} />
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
              // [추가 4] 요약 정보를 업데이트하는 함수를 props로 전달합니다.
              setRouteSummary={setRouteSummary}
            />
          )}
        </MapLoader>
      </div>
    </div>
  );
}