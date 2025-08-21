// src/components/RouteSummary.jsx
import React from 'react';

/**
 * 경로의 각 단계를 시각적으로 표현하는 아이템(세그먼트) 컴포넌트입니다.
 * @param {object} segment - 표시할 경로 구간 정보 (subPath 배열의 요소)
 * @param {boolean} isLast - 이 구간이 전체 경로의 마지막 구간인지 여부
 */
const RouteSegment = ({ segment, isLast }) => {
  // 각 변수는 교통수단에 따라 다른 값을 가집니다.
  let icon, title, details;

  // `trafficType`에 따라 아이콘, 제목, 상세정보를 설정합니다.
  // 이 값들은 ODsay API 명세를 따릅니다.
  if (segment.trafficType === 1) { // 1: 지하철
    icon = '🚇';
    // 지하철 노선 이름(예: "수도권 7호선")에 노선별 고유 색상을 적용하여 표시합니다.
    title = <span style={{ color: segment.laneColor, fontWeight: 'bold' }}>{segment.lane[0]?.name}</span>;
    details = `${segment.startName} → ${segment.endName} (${segment.stationCount}개 역 이동)`;
  } else if (segment.trafficType === 2) { // 2: 버스
    icon = '🚌';
    // 버스 번호에 노선별 고유 색상을 적용하여 표시합니다.
    title = <span style={{ color: segment.laneColor, fontWeight: 'bold' }}>{segment.lane[0]?.busNo}번 버스</span>;
    details = `${segment.startName} → ${segment.endName} (${segment.stationCount}개 정류장)`;
  } else if (segment.trafficType === 4) { // 4: 자전거 (따릉이GO에서 정의한 커스텀 타입)
    icon = '🚲';
    title = <span style={{ color: segment.laneColor, fontWeight: 'bold' }}>따릉이</span>;
    // 상세 정보에 시간, 거리, 평균 속도를 모두 표시하도록 수정합니다.
    details = `${segment.startName} → ${segment.endName} (${segment.sectionTime}분, ${Math.round(segment.distance)}m, ${segment.avgSpeed.toFixed(1)}km/h)`;
  }
  else { // 3: 도보
    icon = '🚶';
    title = `도보 ${segment.sectionTime}분`;
    
    // IntegratedRoute.jsx에서 추가해 준 startName과 endName이 있는지 확인합니다.
    if (segment.startName && segment.endName) {
      // 두 이름이 모두 있다면, "출발지 → 도착지 (이동 거리)" 형식으로 상세 정보를 만듭니다.
      details = `${segment.startName} → ${segment.endName} (${segment.distance}m 이동)`;
    } else {
      // 그렇지 않은 경우(예: 중간 환승 도보), 기존처럼 이동 거리만 표시합니다.
      details = `${segment.distance}m 이동`;
    }
  }

  // 각 경로 단계를 렌더링합니다.
  return (
    <div className="flex items-start">
      {/* 아이콘과 세로 선을 표시하는 부분 */}
      <div className="flex flex-col items-center mr-4">
        <span className="text-2xl">{icon}</span>
        {/* 마지막 단계가 아닐 경우에만 아이콘 아래에 세로 연결선을 그립니다. */}
        {!isLast && <div className="w-px h-12 bg-gray-300 mt-1"></div>}
      </div>
      {/* 경로의 상세 정보를 표시하는 부분 */}
      <div className="pb-10">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-gray-600">{details}</p>
      </div>
    </div>
  );
};


/**
 * 전체 경로 요약 정보를 표시하는 메인 컴포넌트입니다.
 * @param {object} summary - ODsay API 응답의 경로 정보 객체 (path[0])
 */
export default function RouteSummary({ summary }) {
  // `summary` 데이터가 없으면 아무것도 렌더링하지 않습니다.
  if (!summary) {
    return null;
  }
  
  // `summary` 객체에서 총 소요 시간(info)과 세부 경로 목록(subPath)을 추출합니다.
  const { info, subPath } = summary;

  // 따릉이 이용 시간과 대중교통 이용 시간을 각각 계산합니다.
  const bikeTime = subPath.reduce(
    (acc, seg) => (seg.trafficType === 4 ? acc + (seg.sectionTime || 0) : acc),
    0,
  );
  const transitTime = subPath.reduce(
    (acc, seg) =>
      seg.trafficType === 1 || seg.trafficType === 2
        ? acc + (seg.sectionTime || 0)
        : acc,
    0,
  );

  // "도보 0분" 문제를 해결하기 위해 화면에 표시할 경로만 필터링합니다.
  const visibleSubPath = subPath.filter((segment, index) => {
    // 필터링할 조건: 도보(3)이면서, 이동시간(sectionTime)이 0분이고, 첫 번째 구간(index === 0)이 아닐 때
    const isZeroMinTransferWalk = 
      segment.trafficType === 3 && segment.sectionTime === 0 && index !== 0;
    
    // 위의 조건이 참(true)이면 필터에서 제외(false 반환), 거짓이면 포함(true 반환)
    return !isZeroMinTransferWalk;
  });

  return (
    <div className="mt-6 p-4 border rounded-lg bg-gray-50">
      {/* 경로 요약의 최상단부 (총 소요 시간 등) */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">✅ 경로 요약</h3>
        <p className="mt-1">
          <span className="font-medium">🕒 총 소요 시간:</span>
          <span className="text-blue-600 font-bold ml-2">{info.totalTime}분</span>
        </p>
        <p className="mt-1">
          <span className="font-medium">🚲 따릉이 시간:</span>
          <span className="text-blue-600 font-bold ml-2">{bikeTime}분</span>
        </p>
        <p className="mt-1">
          <span className="font-medium">🚍 대중교통 시간:</span>
          <span className="text-blue-600 font-bold ml-2">{transitTime}분</span>
        </p>
      </div>
      
      {/* 필터링된 경로 목록(visibleSubPath)을 순회하며 각 단계를 렌더링합니다. */}
      <div>
        {visibleSubPath.map((segment, index) => (
          <RouteSegment 
            key={index} 
            segment={segment} 
            // 마지막 아이템인지 여부를 필터링된 배열 기준으로 다시 판단합니다.
            isLast={index === visibleSubPath.length - 1} 
          />
        ))}
      </div>
    </div>
  );
}