// src/components/IntegratedRoute.jsx
import React, { useEffect } from "react";
import RouteLine from "./RouteLine";
import haversine from "../utils/haversine";

function getZoomLevelForDistance(distance) {
  if (distance > 40000) return 10;
  if (distance > 20000) return 11;
  if (distance > 10000) return 12;
  if (distance > 5000) return 13;
  if (distance > 2500) return 14;
  if (distance > 1200) return 15;
  return 16;
}

export default function IntegratedRoute({
    mapInstance,
    routes,
    selectedIndex,
}) {
    const selectedRoute = routes?.[selectedIndex];

    useEffect(() => {
        if (!mapInstance || !selectedRoute?.segments) return;

        const allCoords = selectedRoute.segments.flatMap(segment => segment?.coords || []);
        if (allCoords.length < 2) {
            if (allCoords.length === 1) mapInstance.setCenter(allCoords[0]);
            return;
        }

        const bounds = allCoords.reduce(
            (b, p) => b.extend(p),
            new window.naver.maps.LatLngBounds(allCoords[0], allCoords[0])
        );

        mapInstance.setCenter(bounds.getCenter());

        const startPoint = allCoords[0];
        const endPoint = allCoords[allCoords.length - 1];
        const distance = haversine(startPoint.lat(), startPoint.lng(), endPoint.lat(), endPoint.lng());
        
        const zoom = getZoomLevelForDistance(distance);
        mapInstance.setZoom(zoom);

    }, [selectedIndex, selectedRoute, mapInstance]);

    const currentSegments = selectedRoute?.segments || [];

    return (
        <>
            {currentSegments.map((segment, index) => (
                segment && <RouteLine
                    key={`${selectedIndex}-${index}`} 
                    map={mapInstance}
                    coords={segment.coords}
                    color={segment.color}
                />
            ))}
        </>
    );
}