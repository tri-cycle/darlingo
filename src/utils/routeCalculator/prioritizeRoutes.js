export function prioritizeRoutes(routes) {
  if (!Array.isArray(routes)) return [];

  const hybridRoutes = [];
  const bikeOnlyRoutes = [];

  for (const route of routes) {
    const subPaths = route?.summary?.subPath || [];
    const hasBike = subPaths.some(path => path?.trafficType === 4);
    const hasNonBike = subPaths.some(path => path?.trafficType !== 4);

    if (!hasBike) {
      continue;
    }

    if (hasNonBike) {
      hybridRoutes.push(route);
    } else if (hasBike) {
      bikeOnlyRoutes.push(route);
    }
  }

  return [...hybridRoutes, ...bikeOnlyRoutes];
}
