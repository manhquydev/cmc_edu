export interface CapturedGeo {
  lat: number;
  lng: number;
  accuracyM: number;
}

/**
 * Resolve null when: no navigator.geolocation, denied, timeout 8s, or any error.
 * NEVER throws — geo is absolutely optional for punch.
 */
export function captureGeolocation(): Promise<CapturedGeo | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
      );
    } catch {
      resolve(null);
    }
  });
}
