import { useState, useEffect, useCallback } from 'react';

export interface GeolocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface DistanceResult {
  distanceKm: number;
  travelMins: number;
  formatted: string;
}

export function useGeolocation(options: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }) {
  const [coords, setCoords] = useState<GeolocationCoords | null>(() => {
    // Check for cached position or fallback default (New Delhi / NCR)
    try {
      const cached = localStorage.getItem('agent_last_gps');
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return null;
  });

  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Haversine formula to compute distance in km and estimated travel time in minutes
  const distanceTo = useCallback((destLat: number, destLng: number): DistanceResult => {
    if (!coords || !destLat || !destLng) {
      return { distanceKm: 0, travelMins: 0, formatted: '0 km away' };
    }

    const R = 6371; // Earth radius in km
    const dLat = (destLat - coords.latitude) * (Math.PI / 180);
    const dLng = (destLng - coords.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coords.latitude * (Math.PI / 180)) *
      Math.cos(destLat * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Math.round(R * c * 10) / 10;
    
    // Urban speed approx 25 km/h + 3 min buffer for parking/walking
    const travelMins = Math.max(2, Math.round((distanceKm / 25) * 60) + 3);

    return {
      distanceKm,
      travelMins,
      formatted: `${distanceKm} km away · ~${travelMins} mins travel`
    };
  }, [coords]);

  const refreshLocation = useCallback((cb?: (coords: GeolocationCoords) => void) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords: GeolocationCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
        };
        setCoords(newCoords);
        setError(null);
        try {
          localStorage.setItem('agent_last_gps', JSON.stringify(newCoords));
        } catch (_) {}
        if (cb) cb(newCoords);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setError(err.message);
        // Fallback to existing or Delhi NCR
        if (cb && coords) cb(coords);
      },
      options
    );
  }, [options, coords]);

  useEffect(() => {
    // Immediately attempt to get live device position on mount
    refreshLocation();

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords: GeolocationCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
        };
        setCoords(newCoords);
        setError(null);
        try {
          localStorage.setItem('agent_last_gps', JSON.stringify(newCoords));
        } catch (_) {}
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
        setError(err.message);
      },
      options
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsTracking(false);
    };
  }, []);

  return {
    coords,
    isTracking,
    error,
    distanceTo,
    refreshLocation
  };
}
