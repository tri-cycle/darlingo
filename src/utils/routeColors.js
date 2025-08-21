// src/utils/routeColors.js

/**
 * 경로 종류에 따른 고정 색상 코드를 정의합니다.
 */
export const ROUTE_COLORS = {
  BUS: '#E60012',    // 버스: 빨간색
  SUBWAY: '#996CAC', // 지하철: 보라색
  WALK: '#3880ff',   // 도보: 파란색
  BIKE: '#00c851',   // 자전거: 초록색
};

/**
 * ODsay API의 교통 수단 코드(trafficType)에 따라 적절한 색상을 반환합니다.
 * @param {number} trafficType - 1(지하철), 2(버스), 3(도보)
 * @returns {string} Hex 색상 코드
 */
export function getColorByTrafficType(trafficType) {
  switch (trafficType) {
    case 1:
      return ROUTE_COLORS.SUBWAY;
    case 2:
      return ROUTE_COLORS.BUS;
    case 3:
    default:
      return ROUTE_COLORS.WALK;
  }
}