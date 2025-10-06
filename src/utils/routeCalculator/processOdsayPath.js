import { fetchTmapRoute } from "../fetchTmapRoute";
import { getColorByTrafficType } from "../routeColors";

/**
 * Odsay API 경로 정보를 네이버 지도용 세그먼트로 변환한다.
 * @param {object} odsayPath - Odsay API의 path 객체.
 * @param {{lat:number,lng:number}} overallStart - 전체 경로 시작 좌표.
 * @param {{lat:number,lng:number}} overallEnd - 전체 경로 종료 좌표.
 * @returns {Promise<Array<{type:string,color:string,coords:Array}>|null>} 변환된 세그먼트 배열. 실패 시 null.
 */
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
        // 🚇 지하철 or 🚌 버스
        if (sp.passStopList?.stations) {
          coords = sp.passStopList.stations.map(
            s => new window.naver.maps.LatLng(+s.y, +s.x)
          );
        }
      } else if (sp.trafficType === 3) {
        // 🚶 도보
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
          if (tmapRoute && tmapRoute.length > 0) {
            coords = tmapRoute;
          } else {
            // ✅ fallback: 최소한 start~end 좌표만 연결
            coords = [
              new window.naver.maps.LatLng(startPoint.lat, startPoint.lng),
              new window.naver.maps.LatLng(endPoint.lat, endPoint.lng),
            ];
            console.warn("Tmap 도보 경로 실패 → fallback 좌표로 대체");
          }
        }
      }

      if (coords.length > 0) {
        const prevSegment = processedSegments[processedSegments.length - 1];
        if (prevSegment?.coords.length > 0) {
          coords.unshift(prevSegment.coords.slice(-1)[0]);
        }
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
