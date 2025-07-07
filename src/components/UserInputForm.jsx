// src/components/UserInputForm.jsx
import React, { useContext } from "react";
import { RouteContext } from "../context/RouteContext";  // RouteContext 직접 가져오기
import PlaceAutocomplete from "./PlaceAutocomplete";

export default function UserInputForm({ bikeTimeSec, setBikeTimeSec }) {
  const { setStartLocation, setEndLocation } = useContext(RouteContext);

  return (
    <div className="space-y-4">
      {/* 출발지 */}
      <div>
        <label className="block mb-1 font-medium">출발지</label>
        <PlaceAutocomplete onPlaceSelected={setStartLocation} />
      </div>

      {/* 도착지 */}
      <div>
        <label className="block mb-1 font-medium">도착지</label>
        <PlaceAutocomplete onPlaceSelected={setEndLocation} />
      </div>

      {/* 자전거 이용 시간 입력 */}
      <div>
        <label className="block mb-1 font-medium">자전거 이용 시간 (분)</label>
        <input
          type="number"
          min="1"
          value={Math.round(bikeTimeSec / 60)}
          onChange={(e) => {
            const minutes = parseInt(e.target.value, 10) || 0;
            setBikeTimeSec(minutes * 60);
          }}
          className="w-full border px-3 py-2 rounded"
          placeholder="예: 15"
        />
      </div>
    </div>
  );
}
