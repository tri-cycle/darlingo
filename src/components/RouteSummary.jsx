// src/components/RouteSummary.jsx
import React from 'react';

/**
 * 경로의 각 단계를 시각적으로 표현하는 아이템 컴포넌트입니다.
 */
const RouteSegment = ({ segment, isLast }) => {
  let icon, title, details;

  // 교통수단 타입에 따라 아이콘, 제목, 상세정보를 설정합니다.
  if (segment.trafficType === 1) { // 지하철
    icon = '🚇';
    title = <span style={{ color: segment.laneColor, fontWeight: 'bold' }}>{segment.lane[0]?.name}</span>;
    details = `${segment.startName} → ${segment.endName} (${segment.stationCount}개 역 이동)`;
  } else if (segment.trafficType === 2) { // 버스
    icon = '🚌';
    title = <span style={{ color: segment.laneColor, fontWeight: 'bold' }}>{segment.lane[0]?.busNo}번 버스</span>;
    details = `${segment.startName} → ${segment.endName} (${segment.stationCount}개 정류장)`;
  } else if (segment.trafficType === 4) { // 자전거 (커스텀 타입)
    icon = '🚲';
    title = <span style={{ color: segment.laneColor, fontWeight: 'bold' }}>따릉이</span>;
    details = `${segment.startName} → ${segment.endName} (${segment.sectionTime}분)`;
  }
  else { // 도보 (trafficType === 3)
    icon = '🚶';
    title = `도보 ${segment.sectionTime}분`;
    details = `${segment.distance}m 이동`;
  }

  return (
    <div className="flex items-start">
      <div className="flex flex-col items-center mr-4">
        <span className="text-2xl">{icon}</span>
        {!isLast && <div className="w-px h-12 bg-gray-300 mt-1"></div>}
      </div>
      <div className="pb-10">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-gray-600">{details}</p>
      </div>
    </div>
  );
};


export default function RouteSummary({ summary }) {
  if (!summary) {
    return null;
  }
  
  const { info, subPath } = summary;

  return (
    <div className="mt-6 p-4 border rounded-lg bg-gray-50">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">✅ 경로 요약</h3>
        <p className="mt-1">
          <span className="font-medium">🕒 총 소요 시간:</span>
          <span className="text-blue-600 font-bold ml-2">{info.totalTime}분</span>
        </p>
      </div>
      
      <div>
        {subPath.map((segment, index) => (
          <RouteSegment 
            key={index} 
            segment={segment} 
            isLast={index === subPath.length - 1} 
          />
        ))}
      </div>
    </div>
  );
}