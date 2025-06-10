import { createContext, useState } from "react";

export const RouteContext = createContext();

export function RouteContextProvider({ children }) {
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);

  return (
    <RouteContext.Provider
      value={{ startLocation, setStartLocation, endLocation, setEndLocation }}
    >
      {children}
    </RouteContext.Provider>
  );
}
