import { fetchTmapRoute } from "../fetchTmapRoute";
import { getColorByTrafficType } from "../routeColors";

export async function processOdsayPath(odsayPath, overallStart, overallEnd) {
  try {
    const subPaths = odsayPath?.subPath || [];
    if (!subPaths.length) return [];

    const processedSegments = [];
    for (let i = 0; i < subPaths.length; i++) {
      const sp = subPaths[i];
      let coords = [];
      const color = getColorByTrafficType(sp.trafficType);

      if (sp.trafficType === 1 || sp.trafficType === 2) {
        if (sp.passStopList?.stations) {
          coords = sp.passStopList.stations.map(s => new window.naver.maps.LatLng(+s.y, +s.x));
        }
      } else if (sp.trafficType === 3) {
        let startPoint, endPoint;
        const prevPath = subPaths[i - 1];
        const nextPath = subPaths[i + 1];
        if (i === 0) startPoint = overallStart;
        else if (prevPath?.passStopList?.stations?.length > 0) {
          startPoint = {
            lat: +prevPath.passStopList.stations.slice(-1)[0].y,
            lng: +prevPath.passStopList.stations.slice(-1)[0].x,
          };
        }
        if (i === subPaths.length - 1) endPoint = overallEnd;
        else if (nextPath?.passStopList?.stations?.length > 0) {
          endPoint = {
            lat: +nextPath.passStopList.stations[0].y,
            lng: +nextPath.passStopList.stations[0].x,
          };
        }
        if (startPoint && endPoint) {
          const tmapRoute = await fetchTmapRoute(startPoint, endPoint);
          if (!tmapRoute) return null;
          coords = tmapRoute;
        }
      }

      if (coords.length > 0) {
        const prevSegment = processedSegments[processedSegments.length - 1];
        if (prevSegment?.coords.length > 0) coords.unshift(prevSegment.coords.slice(-1)[0]);
        processedSegments.push({
          ...sp,
          type: sp.trafficType === 1 ? "subway" : sp.trafficType === 2 ? "bus" : "walk",
          color,
          coords,
        });
      }
    }
    return processedSegments;
  } catch (error) {
    console.error("Odsay 경로 처리 실패:", error);
    return null;
  }
}