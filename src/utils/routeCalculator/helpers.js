import haversine from "../haversine";

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

export function getTotalTime(path) {
  return path?.info?.totalTime ?? (path?.subPath || []).reduce((sum, sp) => sum + (sp.sectionTime || 0), 0);
}

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

export function sortCandidates(candidates) {
  return candidates.sort((a, b) => getTotalTime(a.summary) - getTotalTime(b.summary));
}

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