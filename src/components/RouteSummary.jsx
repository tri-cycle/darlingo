// src/components/RouteSummary.jsx
import React from "react";

const RouteSegment = ({ segment, isLast }) => {
  let icon, title, details, bgGradient, borderColor;

  if (segment.trafficType === 1) {
    icon = "🚇";
    bgGradient = "from-purple-500 to-purple-600";
    borderColor = "border-purple-200";
    title = `${segment.lane?.[0]?.name || "지하철"}`;
    details = `${segment.startName} → ${segment.endName} · ${segment.stationCount}역 · ${segment.sectionTime}분`;
  } else if (segment.trafficType === 2) {
    icon = "🚌";
    bgGradient = "from-red-500 to-red-600";
    borderColor = "border-red-200";
    title = `${segment.lane?.[0]?.busNo || "버스"}`;
    details = `${segment.startName} → ${segment.endName} · ${segment.stationCount}정류장 · ${segment.sectionTime}분`;
  } else if (segment.trafficType === 4) {
    icon = "🚲";
    bgGradient = "from-emerald-500 to-green-600";
    borderColor = "border-emerald-200";
    title = "따릉이";
    details = `${segment.startName} → ${segment.endName} · ${Math.round(segment.distance)}m · ${segment.sectionTime}분`;
  } else {
    icon = "🚶";
    bgGradient = "from-blue-500 to-blue-600";
    borderColor = "border-blue-200";
    title = "도보";
    details = `${segment.distance}m · ${segment.sectionTime}분`;
  }

  return (
    <div className="relative">
      <div className="flex items-start space-x-4">
        <div className="relative flex-shrink-0">
          <div
            className={`w-10 h-10 bg-gradient-to-br ${bgGradient} rounded-xl flex items-center justify-center text-lg text-white shadow`}
          >
            {icon}
          </div>
          {!isLast && (
            <div className="absolute left-1/2 top-10 w-0.5 h-6 bg-gray-200 -translate-x-1/2"></div>
          )}
        </div>
        <div
          className={`flex-1 bg-white rounded-xl p-4 border ${borderColor} shadow-sm`}
        >
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-600 mt-1">{details}</p>
        </div>
      </div>
      {!isLast && <div className="h-3"></div>}
    </div>
  );
};

export default function RouteSummary({ summary }) {
  if (!summary) return null;
  const { info, subPath } = summary;

  const bikeTime = subPath.reduce(
    (acc, seg) => (seg.trafficType === 4 ? acc + (seg.sectionTime || 0) : acc),
    0
  );
  const transitTime = subPath.reduce(
    (acc, seg) =>
      [1, 2].includes(seg.trafficType) ? acc + (seg.sectionTime || 0) : acc,
    0
  );
  const walkTime = subPath.reduce(
    (acc, seg) => (seg.trafficType === 3 ? acc + (seg.sectionTime || 0) : acc),
    0
  );

  const visibleSubPath = subPath.filter(
    (seg, i) => !(seg.trafficType === 3 && seg.sectionTime === 0 && i !== 0)
  );

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center space-x-2">
        <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
          <svg
            className="w-4 h-4 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900">경로 상세</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
      </div>

      {/* 총 소요 시간 */}
      <div className="bg-white rounded-2xl p-5 shadow text-center">
        <p className="text-sm text-gray-600">총 소요 시간</p>
        <p className="text-2xl font-bold text-blue-600">{info.totalTime}분</p>
      </div>

      {/* 시간 분해 */}
      <div className="flex flex-wrap gap-3">
        {bikeTime > 0 && (
          <div className="flex items-center gap-1 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
            <span>🚲</span>
            <span className="text-sm font-medium text-emerald-700">
              {bikeTime}분
            </span>
          </div>
        )}
        {transitTime > 0 && (
          <div className="flex items-center gap-1 px-3 py-2 bg-purple-50 rounded-xl border border-purple-200">
            <span>🚇</span>
            <span className="text-sm font-medium text-purple-700">
              {transitTime}분
            </span>
          </div>
        )}
        {walkTime > 0 && (
          <div className="flex items-center gap-1 px-3 py-2 bg-blue-50 rounded-xl border border-blue-200">
            <span>🚶</span>
            <span className="text-sm font-medium text-blue-700">
              {walkTime}분
            </span>
          </div>
        )}
      </div>

      {/* 단계별 안내 */}
      <div className="space-y-3">
        {visibleSubPath.map((seg, i) => (
          <RouteSegment
            key={i}
            segment={seg}
            isLast={i === visibleSubPath.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
