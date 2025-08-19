import assert from 'assert';

// sortCandidates 로직을 재현해 경유지가 있을 때 자전거 시간이 제한을 초과해도 필터링되지 않는지 확인
function calcWalkTime(summary) {
  if (!summary || !summary.subPath) return Infinity;
  return summary.subPath.reduce((acc, sp) => (sp.trafficType === 3 ? acc + (sp.sectionTime || 0) : acc), 0);
}
function calcBikeTime(summary) {
  if (!summary || !summary.subPath) return Infinity;
  return summary.subPath.reduce((acc, sp) => (sp.trafficType === 4 ? acc + (sp.sectionTime || 0) : acc), 0);
}
function sortCandidates(
  list,
  bikeLimitSec = Infinity,
  hasWaypoints = false,
  minBikeTimeSec = 0
) {
  const bikeFiltered = list.filter(
    r => calcBikeTime(r.summary) * 60 >= minBikeTimeSec
  );
  const filtered = hasWaypoints
    ? bikeFiltered
    : bikeFiltered.filter(
        r => calcBikeTime(r.summary) * 60 <= bikeLimitSec + 120
      );
  return filtered.sort((a, b) => {
    const aWalk = calcWalkTime(a.summary);
    const bWalk = calcWalkTime(b.summary);
    if (aWalk >= 60 && bWalk >= 60) {
      const aBike = calcBikeTime(a.summary);
      const bBike = calcBikeTime(b.summary);
      return aBike - bBike;
    }
    if (aWalk >= 60) return 1;
    if (bWalk >= 60) return -1;
    const aBike = calcBikeTime(a.summary);
    const bBike = calcBikeTime(b.summary);
    if (aBike !== bBike) return aBike - bBike;
    return aWalk - bWalk;
  });
}

// 경유지가 포함된 자전거/대중교통/도보 혼합 경로
const candidate = {
  summary: {
    subPath: [
      { trafficType: 3, sectionTime: 5 }, // 도보
      { trafficType: 4, sectionTime: 20 }, // 자전거 20분
      { trafficType: 2, sectionTime: 20 }, // 버스
      { trafficType: 3, sectionTime: 5 }, // 도보
    ],
  },
};

// 경유지가 있을 때는 제한을 넘어도 필터링되지 않는다.
const resultWithWaypoints = sortCandidates([candidate], 900, true, 900); // 제한 15분(900초)
assert.strictEqual(resultWithWaypoints.length, 1);
assert.deepStrictEqual(
  resultWithWaypoints[0].summary.subPath.map(sp => sp.trafficType),
  [3, 4, 2, 3]
);

// 경유지가 없으면 필터링된다.
const resultWithoutWaypoints = sortCandidates([candidate], 900, false);
assert.strictEqual(resultWithoutWaypoints.length, 0);

console.log('Waypoint route test passed');
