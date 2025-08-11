import { useState, useEffect } from "react";

export default function useCurrentLocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 위치 정보를 지원하지 않습니다.");
      setLoading(false);
      return;
    }

    const onSuccess = (pos) => {
      setLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
      setLoading(false);
    };

    const onError = (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          setError("위치 정보 사용이 거부되었습니다.");
          break;
        case err.POSITION_UNAVAILABLE:
          setError("위치 정보를 사용할 수 없습니다.");
          break;
        case err.TIMEOUT:
          setError("위치 정보를 가져오는 데 시간이 초과되었습니다.");
          break;
        default:
          setError("위치 정보를 가져오는데 실패했습니다.");
      }
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError);
  }, []);

  return { location, error, loading };
}
