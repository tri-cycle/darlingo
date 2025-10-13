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
    strokeWidth="2"
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
    strokeWidth="2"
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

const LocationIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z"
    />
  </svg>
);

const FlagIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5v.5"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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
    <div className="space-y-6">
      {/* 출발지 */}
      <div className="space-y-3">
        <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700">
          <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
            <LocationIcon />
          </div>
          <span>출발지</span>
        </label>
        <div className="relative">
          <PlaceAutocomplete
            value={startLocation?.name}
            onPlaceSelected={setStartLocation}
            placeholder="출발지를 입력하세요"
          />
        </div>
      </div>

      {/* 경유지 목록 */}
      {waypoints.map((_, index) => (
        <div key={index} className="space-y-3">
          <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700">
            <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            </div>
            <span>경유지</span>
          </label>
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <PlaceAutocomplete
                onPlaceSelected={(place) => updateWaypoint(index, place)}
                placeholder="경유지를 입력하세요"
              />
            </div>
            <button
              type="button"
              onClick={() => removeWaypoint(index)}
              className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      ))}

      {/* 도착지 */}
      <div className="space-y-3">
        <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700">
          <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center">
            <FlagIcon />
          </div>
          <span>도착지</span>
        </label>
        <div className="relative">
          <PlaceAutocomplete
            value={endLocation?.name}
            onPlaceSelected={setEndLocation}
            placeholder="도착지를 입력하세요"
          />
        </div>
      </div>

      {/* 경유지 추가 및 위치 교환 버튼 */}
      <div className="flex items-center space-x-3 pt-2">
        <button
          type="button"
          onClick={() => addWaypoint(null)}
          disabled={waypoints.length >= 1}
          className="flex-1 flex items-center justify-center space-x-2 border-2 border-dashed border-gray-300 rounded-xl py-4 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 group"
        >
          <PlusIcon />
          <span className="font-medium">경유지 추가</span>
        </button>
        <button
          type="button"
          onClick={swapLocations}
          className="p-4 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all duration-200 group"
          title="출발지와 도착지 바꾸기"
        >
          <SwapIcon />
        </button>
      </div>
      
      {waypoints.length >= 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-amber-700 font-medium">
              경유지는 최대 1개까지 추가할 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}