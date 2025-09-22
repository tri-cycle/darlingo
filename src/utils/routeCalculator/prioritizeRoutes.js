export function prioritizeRoutes(routes) {
  if (!Array.isArray(routes)) return [];

  const hybridRoutes = [];
  const transitOnlyRoutes = [];
  const bikeOnlyRoutes = [];

  for (const route of routes) {
    const subPaths = route?.summary?.subPath || [];
    const hasBike = subPaths.some(path => path?.trafficType === 4);
    const hasNonBike = subPaths.some(path => path?.trafficType !== 4);

    if (hasBike && hasNonBike) {
      hybridRoutes.push(route);
    } else if (hasBike) {
      bikeOnlyRoutes.push(route);
    } else {
      transitOnlyRoutes.push(route);
    }
  }

  return [...hybridRoutes, ...transitOnlyRoutes, ...bikeOnlyRoutes];
}
