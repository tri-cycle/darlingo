// src/components/IntegratedRoute.jsx

import React, { useEffect } from "react";
import { fetchOdsayRoute } from "../utils/fetchOdsayRoute";
import { fetchBikeRoute } from "../utils/fetchBikeRoute";
import { fetchTmapRoute } from "../utils/fetchTmapRoute";
import polyline from "polyline";
import RouteLine from "./RouteLine";
import haversine from "../utils/haversine";
import { ROUTE_COLORS, getColorByTrafficType } from "../utils/routeColors";

/**
 * ODsay 경로 데이터에서 지도에 그릴 수 있는 세그먼트를 생성합니다.
 */
async function processOdsayPath(path, overallStart, overallEnd) {
  const subPaths = path?.subPath || [];
  const processed = [];
  for (let i = 0; i < subPaths.length; i++) {
    const sp = subPaths[i];
    let coords = [];
    let type = "";
    const color = getColorByTrafficType(sp.trafficType);
    if (sp.trafficType === 1 || sp.trafficType === 2) {
      type = sp.trafficType === 1 ? "subway" : "bus";
      if (sp.passStopList?.stations) {
        coords = sp.passStopList.stations.map(
          (s) => new window.naver.maps.LatLng(+s.y, +s.x)
        );
      }
    } else if (sp.trafficType === 3) {
      type = "walk";
      let startPoint;
      let endPoint;
      if (i === 0) {
        startPoint = overallStart;
        const next = subPaths[i + 1];
        if (next?.passStopList?.stations?.length > 0) {
          endPoint = {
            lat: +next.passStopList.stations[0].y,
            lng: +next.passStopList.stations[0].x,
          };
        } else {
          endPoint = overallEnd;
        }
      } else if (i === subPaths.length - 1) {
        const prev = subPaths[i - 1];
        if (prev?.passStopList?.stations?.length > 0) {
          const last = prev.passStopList.stations[prev.passStopList.stations.length - 1];
          startPoint = { lat: +last.y, lng: +last.x };
        }
        endPoint = overallEnd;
      } else {
        const prev = subPaths[i - 1];
        const next = subPaths[i + 1];
        if (prev?.passStopList?.stations?.length > 0 && next?.passStopList?.stations?.length > 0) {
          const last = prev.passStopList.stations[prev.passStopList.stations.length - 1];
          const first = next.passStopList.stations[0];
          startPoint = { lat: +last.y, lng: +last.x };
          endPoint = { lat: +first.y, lng: +first.x };
        }
      }
      if (startPoint && endPoint) {
        coords = await fetchTmapRoute(startPoint, endPoint);
      }
    }
    if (coords.length > 0) {
      if (processed.length > 0) {
        const prevSeg = processed[processed.length - 1];
        if (prevSeg.coords.length > 0) {
          const stitch = prevSeg.coords[prevSeg.coords.length - 1];
          coords.unshift(stitch);
        }
      }
      processed.push({ ...sp, type, color, coords });
    }
  }
  return processed;
}

/**
 * 하나의 구간(start→end)에 대한 세그먼트와 요약 정보를 생성합니다.
 *
 * @param {object} a - 출발지 객체
 * @param {object} b - 도착지 객체
 * @param {object} path - ODsay에서 받은 path 객체
 * @param {boolean} includeBike - true이면 자전거 세그먼트를 추가
 */
async function buildSegment(a, b, path, includeBike) {
  if (!path) {
    throw new Error("ODsay 경로를 찾을 수 없습니다.");
  }

  const segments = await processOdsayPath(path, a, b);
  const summary = {
    info: { totalTime: path.info.totalTime },
    subPath: [...(path.subPath || [])],
  };

  if (includeBike) {
    const bikeData = await fetchBikeRoute([
      [a.lng, a.lat],
      [b.lng, b.lat],
    ]);
    const bikeCoords = polyline
      .decode(bikeData.routes[0].geometry, 5)
      .map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
    segments.unshift({
      type: "bike",
      color: ROUTE_COLORS.BIKE,
      coords: bikeCoords,
    });
    const { distance, duration } = bikeData.routes[0].summary;
    const sectionTime = Math.round(duration / 60);
    summary.info.totalTime += sectionTime;
    summary.subPath.unshift({
      trafficType: 4,
      laneColor: ROUTE_COLORS.BIKE,
      startName: a.name,
      endName: b.name,
      sectionTime,
      distance,
      avgSpeed: (distance / 1000) / (duration / 3600),
    });
  }

  return { segments, summary };
}

export default function IntegratedRoute({
  mapInstance,
  start,
  end,
  waypoints = [],
  routes,
  selectedIndex,
  setRoutes,
  setIsCalculating,
}) {
  useEffect(() => {
    if (!mapInstance || !start || !end || waypoints.length === 0) return;

    setIsCalculating?.(true);

    (async () => {
      try {
        const via = waypoints[0];
        const dist1 = haversine(start.lat, start.lng, via.lat, via.lng);
        const dist2 = haversine(via.lat, via.lng, end.lat, end.lng);

        const [res1, res2] = await Promise.all([
          fetchOdsayRoute(
            { y: start.lat, x: start.lng },
            { y: via.lat, x: via.lng },
            null,
            { searchType: 0, searchPathType: 0 }
          ),
          fetchOdsayRoute(
            { y: via.lat, x: via.lng },
            { y: end.lat, x: end.lng },
            null,
            { searchType: 0, searchPathType: 0 }
          ),
        ]);

        const paths1 = res1?.result?.path?.slice(0, 5) || [];
        const paths2 = res2?.result?.path?.slice(0, 5) || [];

        const segList1 = [];
        for (const p of paths1) {
          try {
            segList1.push(await buildSegment(start, via, p, dist1 >= dist2));
          } catch (e) {
            console.error(e);
          }
        }

        const segList2 = [];
        for (const p of paths2) {
          try {
            segList2.push(await buildSegment(via, end, p, dist2 > dist1));
          } catch (e) {
            console.error(e);
          }
        }

        const combinations = [];
        for (const a of segList1) {
          for (const b of segList2) {
            combinations.push({
              segments: [...a.segments, ...b.segments],
              summary: {
                info: {
                  totalTime: a.summary.info.totalTime + b.summary.info.totalTime,
                },
                subPath: [...a.summary.subPath, ...b.summary.subPath],
              },
            });
          }
        }

        combinations.sort(
          (a, b) => a.summary.info.totalTime - b.summary.info.totalTime
        );

        setRoutes(combinations.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setIsCalculating?.(false);
      }
    })();
  }, [mapInstance, start, end, waypoints, setRoutes, setIsCalculating]);

  const currentSegments = routes[selectedIndex]?.segments || [];

  return (
    <>
      {currentSegments.map((segment, index) => (
        <RouteLine
          key={`${segment.type}-${index}`}
          map={mapInstance}
          coords={segment.coords}
          color={segment.color}
        />
      ))}
    </>
  );
}
