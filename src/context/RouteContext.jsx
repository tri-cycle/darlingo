// src/context/RouteContext.jsx
import { createContext, useContext, useState } from 'react';

const RouteContext = createContext();

export function RouteProvider({ children }) {
  const [route, setRoute] = useState({
    start: null,   // { title, lat, lon }
    end:   null,
    time:  '',
  });
  return (
    <RouteContext.Provider value={{ route, setRoute }}>
      {children}
    </RouteContext.Provider>
  );
}

export const useRoute = () => useContext(RouteContext);
