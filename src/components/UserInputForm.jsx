// src/components/UserInputForm.jsx
import React, { useContext } from "react";
import { RouteContext } from "../context/RouteContext"; // RouteContext 직접 가져오기
import PlaceAutocomplete from "./PlaceAutocomplete";

export default function UserInputForm() {
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

      {/* 이용 시간 입력은 기본값(15분)을 사용하므로 제거 */}
    </div>
  );
}
