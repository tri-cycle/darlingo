// src/components/DdarungiMarkers.jsx
import { useEffect } from "react";
import useMarkers from "../hooks/useMarkers";
import haversine from "../utils/haversine";
import { NEARBY_RADIUS_METERS } from "../utils/constants";

export default function DdarungiMarkers({ map, center, stations }) {
  const setMarkers = useMarkers(map);

  useEffect(() => {
    if (!map || !center || !stations) {
      setMarkers([]);
      return;
    }

    const newMarkers = [];
    stations.forEach((station) => {
      const lat = parseFloat(station.stationLatitude);
      const lng = parseFloat(station.stationLongitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const dist = haversine(center.lat, center.lng, lat, lng);

      if (dist <= NEARBY_RADIUS_METERS) {
        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(lat, lng),
          title: station.stationName,
          icon: {
            content: `<div style="background-color: #4CAF50; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚲</div>`,
            anchor: new window.naver.maps.Point(14, 14),
          },
        });
        newMarkers.push(marker);
      }
    });

    setMarkers(newMarkers);
  }, [map, center, stations, setMarkers]);

  return null;
}