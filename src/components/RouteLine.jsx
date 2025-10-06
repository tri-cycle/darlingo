// src/components/RouteLine.jsx
import { useEffect, useRef } from "react";

export default function RouteLine({ map, coords, color = "#10b981" }) {
    const polylineRef = useRef(null);

    useEffect(() => {
        if (polylineRef.current) {
            polylineRef.current.setMap(null);
        }
        if (map && Array.isArray(coords) && coords.length >= 2) {
            const newPolyline = new window.naver.maps.Polyline({
                map: map,
                path: coords,
                strokeWeight: 8,
                strokeColor: color,
                strokeOpacity: 0.9,
                strokeStyle: "solid",
                strokeLineCap: "round",
                strokeLineJoin: "round",
                clickable: false,
            });
            polylineRef.current = newPolyline;
        } else {
            polylineRef.current = null;
        }
        return () => {
            if (polylineRef.current) {
                polylineRef.current.setMap(null);
            }
        };
    }, [map, coords, color]);

    return null;
}