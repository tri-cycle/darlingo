let isLoaded = false;

export async function loadGoogleMapsScript(apiKey) {
  if (isLoaded) return;

  const scriptId = "google-maps-script";
  if (document.getElementById(scriptId)) {
    await waitForGoogleMapsReady();
    isLoaded = true;
    return;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta&language=ko`;
    script.async = true;
    script.defer = true;

    script.onload = async () => {
      try {
        await waitForGoogleMapsReady();
        isLoaded = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function waitForGoogleMapsReady(timeout = 3000) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (window.google && window.google.maps && window.google.maps.importLibrary) {
        clearInterval(interval);
        resolve();
      }
    }, 50);

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Google Maps API 로딩 시간 초과"));
    }, timeout);
  });
}
