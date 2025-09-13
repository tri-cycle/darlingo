import haversine from "../haversine";

/**
 * 주어진 지점과 가장 가까운 대여소를 찾는다.
 * @param {{lat:number,lng:number}} point - 기준 좌표.
 * @param {Array<Object>} stations - 대여소 목록.
 * @returns {Object|null} 가장 가까운 대여소 정보.
 */
export function findNearestStation(point, stations) {
  let best = null;
  let minD = Infinity;
  for (const s of stations) {
    const d = haversine(point.lat, point.lng, +s.stationLatitude, +s.stationLongitude);
    if (d < minD) {
      minD = d;
      best = s;
    }
  }
  return best;
}

/**
 * 경로의 총 소요 시간을 계산한다.
 * @param {Object} path - Odsay path 객체.
 * @returns {number} 총 소요 시간(분).
 */
export function getTotalTime(path) {
  return path?.info?.totalTime ?? (path?.subPath || []).reduce((sum, sp) => sum + (sp.sectionTime || 0), 0);
}

/**
 * 중복된 경로 후보를 제거한다.
 * @param {Array<Object>} list - 후보 경로 목록.
 * @returns {Array<Object>} 중복 제거된 목록.
 */
export function removeDuplicates(list) {
  const unique = [];
  const seen = new Set();
  for (const r of list) {
    const key = r.summary ? JSON.stringify(r.summary) : JSON.stringify(r.segments);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique;
}

/**
 * 경로 후보를 총 소요 시간순으로 정렬한다.
 * @param {Array<Object>} candidates - 경로 후보 목록.
 * @returns {Array<Object>} 정렬된 목록.
 */
export function sortCandidates(candidates) {
  return candidates.sort((a, b) => getTotalTime(a.summary) - getTotalTime(b.summary));
}

/**
 * 요약 정보에 출발지/도착지 이름을 추가한다.
 * @param {Object} summary - 요약 정보.
 * @param {{name:string}} overallStart - 출발지 정보.
 * @param {{name:string}} overallEnd - 도착지 정보.
 * @returns {void}
 */
export function addNamesToSummary(summary, overallStart, overallEnd) {
  if (!summary?.subPath?.length) return;
  const subPath = summary.subPath;
  if (subPath[0].trafficType === 3) {
    subPath[0].startName = overallStart.name;
    const nextTransit = subPath.find(p => p.trafficType !== 3);
    if (nextTransit) subPath[0].endName = nextTransit.startName;
  }
  const lastSegment = subPath[subPath.length - 1];
  if (lastSegment.trafficType === 3) {
    lastSegment.endName = overallEnd.name;
    const prevTransit = subPath
      .slice(0, -1)
      .reverse()
      .find(p => p.trafficType !== 3);
    if (prevTransit) lastSegment.startName = prevTransit.endName;
  }
}

