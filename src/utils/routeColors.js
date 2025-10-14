// src/utils/routeColors.js

/**
 * 경로 종류에 따른 구분 가능한 색상 코드를 정의합니다.
 * 초록색을 메인으로 하되 각 교통수단별로 명확히 구분되는 색상 사용
 */
export const ROUTE_COLORS = {
  BUS: '#dc2626',       // 버스: 빨간색 (전통적인 버스 색상)
  SUBWAY: '#7c3aed',    // 지하철: 보라색 (지하철 노선도 색상)
  WALK: '#2563eb',      // 도보: 파란색 (차분한 이동)
  BIKE: '#10b981',      // 자전거: 에메랄드-500 (메인 테마 색상)
};

/**
 * ODsay API의 교통 수단 코드(trafficType)에 따라 적절한 색상을 반환합니다.
 * @param {number} trafficType - 1(지하철), 2(버스), 3(도보), 4(자전거)
 * @returns {string} Hex 색상 코드
 */
export function getColorByTrafficType(trafficType) {
  switch (trafficType) {
    case 1:
      return ROUTE_COLORS.SUBWAY;   // 지하철: 보라색
    case 2:
      return ROUTE_COLORS.BUS;      // 버스: 빨간색
    case 3:
      return ROUTE_COLORS.WALK;     // 도보: 파란색
    case 4:
      return ROUTE_COLORS.BIKE;     // 자전거: 에메랄드 (메인)
    default:
      return ROUTE_COLORS.WALK;     // 기본값: 도보색상
  }
}