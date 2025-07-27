import assert from 'assert';

function calcWalkTime(summary) {
  if (!summary || !summary.subPath) return Infinity;
  return summary.subPath.reduce((acc, sp) => {
    return sp.trafficType === 3 ? acc + (sp.sectionTime || 0) : acc;
  }, 0);
}

function dedupAndSort(routes) {
  const unique = [];
  const seen = new Set();
  for (const r of routes) {
    const key = JSON.stringify(r.summary);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  const sorted = unique.sort((a, b) => {
    const aWalk = calcWalkTime(a.summary);
    const bWalk = calcWalkTime(b.summary);
    if (aWalk >= 60 && bWalk >= 60) return 0;
    if (aWalk >= 60) return 1;
    if (bWalk >= 60) return -1;
    return aWalk - bWalk;
  });
  return sorted.slice(0, 5);
}

const mock = [
  { summary: { subPath: [ { trafficType: 3, sectionTime: 50 } ] } },
  { summary: { subPath: [ { trafficType: 3, sectionTime: 20 } ] } },
  { summary: { subPath: [ { trafficType: 3, sectionTime: 120 } ] } },
  { summary: { subPath: [ { trafficType: 3, sectionTime: 10 } ] } },
  { summary: { subPath: [ { trafficType: 3, sectionTime: 20 } ] } },
];

const result = dedupAndSort(mock);
assert.strictEqual(result.length, 4);
assert.deepStrictEqual(result.map(r => calcWalkTime(r.summary)), [10,20,50,120]);

console.log('All tests passed');
