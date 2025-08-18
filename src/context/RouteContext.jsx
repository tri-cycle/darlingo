import { createContext, useState } from "react";

export const RouteContext = createContext();

export function RouteContextProvider({ children }) {
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [waypoints, setWaypoints] = useState([]);

  const addWaypoint = (waypoint) => {
    setWaypoints((prev) => {
      if (prev.length >= 1) return prev;
      return [...prev, waypoint];
    });
  };

  const updateWaypoint = (index, waypoint) => {
    setWaypoints((prev) =>
      prev.map((wp, i) => (i === index ? waypoint : wp))
    );
  };

  const removeWaypoint = (index) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  const swapLocations = () => {
    const newStart = endLocation;
    const newEnd = startLocation;
    setStartLocation(newStart);
    setEndLocation(newEnd);
  };

  return (
    <RouteContext.Provider
      value={{
        startLocation,
        setStartLocation,
        endLocation,
        setEndLocation,
        waypoints,
        setWaypoints,
        addWaypoint,
        updateWaypoint,
        removeWaypoint,
        swapLocations,
      }}
    >
      {children}
    </RouteContext.Provider>
  );
}
