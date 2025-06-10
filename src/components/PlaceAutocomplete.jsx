// src/components/PlaceAutocomplete.jsx
import { useEffect, useRef } from "react";
import { loadGoogleMapsScript } from "../utils/loadGoogleMaps";

export default function PlaceAutocomplete({ placeholder, onPlaceSelected }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        await loadGoogleMapsScript(apiKey);

        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places");

        const autocomplete = new PlaceAutocompleteElement();
        autocomplete.placeholder = placeholder || "장소를 입력하세요";

        autocomplete.componentRestrictions = { country: "kr" };
        autocomplete.locationRestriction = {
          north: 37.701749,
          south: 37.428270,
          east: 127.183155,
          west: 126.764582,
        };

        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(autocomplete);

        autocomplete.addEventListener("gmp-select", async ({ placePrediction }) => {
          try {
            const place = placePrediction.toPlace();
            await place.fetchFields({
              fields: ["displayName", "formattedAddress", "location"],
            });

            const result = place.toJSON();
            autocomplete.value = result.displayName || "";

            onPlaceSelected?.({
              name: result.displayName || "",
              address: result.formattedAddress || "",
              lat: result.location?.lat,
              lng: result.location?.lng,
            });
          } catch (err) {
            console.error("장소 정보 추출 실패:", err);
          }
        });
      } catch (err) {
        console.error("Google Maps API 로딩 실패:", err);
      }
    };

    init();
  }, [placeholder, onPlaceSelected]);

  return <div ref={containerRef} className="w-80" />;
}
