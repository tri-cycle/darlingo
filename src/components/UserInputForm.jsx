// src/components/UserInputForm.jsx
import React, { useContext } from "react";
import { RouteContext } from "../context/RouteContext"; // RouteContext 직접 가져오기
import PlaceAutocomplete from "./PlaceAutocomplete";

// 아이콘 SVG 정의
const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
    />
  </svg>
);

const SwapIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
    />
  </svg>
);

export default function UserInputForm() {
  const {
    startLocation,
    setStartLocation,
    endLocation,
    setEndLocation,
    waypoints,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    swapLocations,
  } = useContext(RouteContext);

  return (
    <div className="space-y-4">
      {/* 출발지 */}
      <div>
        <label className="block mb-1 font-medium">출발지</label>
        <PlaceAutocomplete
          value={startLocation?.name}
          onPlaceSelected={setStartLocation}
        />
      </div>

      {/* 경유지 목록 */}
      {waypoints.map((_, index) => (
        <div key={index} className="flex items-center space-x-2">
          <div className="flex-1">
            <PlaceAutocomplete
              onPlaceSelected={(place) => updateWaypoint(index, place)}
            />
          </div>
          <button
            type="button"
            onClick={() => removeWaypoint(index)}
            className="text-gray-400 hover:text-red-500"
          >
            <TrashIcon />
          </button>
        </div>
      ))}

      {/* 도착지 */}
      <div>
        <label className="block mb-1 font-medium">도착지</label>
        <PlaceAutocomplete
          value={endLocation?.name}
          onPlaceSelected={setEndLocation}
        />
      </div>

      {/* 경유지 추가 및 위치 교환 버튼 */}
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={() => addWaypoint(null)}
          disabled={waypoints.length >= 2}
          className="flex-1 border-2 border-dashed border-gray-300 rounded-md py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          경유지 추가
        </button>
        <button
          type="button"
          onClick={swapLocations}
          className="p-2 border rounded-md hover:bg-gray-50 text-gray-600"
        >
          <SwapIcon />
        </button>
      </div>
      {waypoints.length >= 2 && (
        <p className="text-xs text-red-500">
          경유지는 최대 2개까지 추가할 수 있습니다.
        </p>
      )}

      {/* 이용 시간 입력은 기본값(15분)을 사용하므로 제거 */}
    </div>
  );
}
