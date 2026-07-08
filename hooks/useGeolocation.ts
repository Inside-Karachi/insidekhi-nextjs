import { useState, useEffect, useCallback } from "react";

/**
 * Karachi city bounds for coordinate validation
 */
const KARACHI_BOUNDS = {
  minLat: 24.7,
  maxLat: 25.2,
  minLng: 66.9,
  maxLng: 67.4,
} as const;

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  permission: PermissionState | null;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  validateKarachi?: boolean;
  onSuccess?: (lat: number, lng: number) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for getting user's geolocation with comprehensive error handling
 *
 * @example
 * const { latitude, longitude, loading, error, getLocation } = useGeolocation({
 *   onSuccess: (lat, lng) => router.push(`/listings?sort=distance&lat=${lat}&lng=${lng}`)
 * });
 */
export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 300000, // 5 minutes
    validateKarachi = true,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
    permission: null,
  });

  // Check permission status
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    let permissionStatus: PermissionStatus | null = null;
    const handlePermissionChange = () => {
      if (permissionStatus) {
        setState((prev) => ({ ...prev, permission: permissionStatus!.state }));
      }
    };
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        permissionStatus = result;
        setState((prev) => ({ ...prev, permission: result.state }));
        result.addEventListener("change", handlePermissionChange);
      })
      .catch(() => {
        // Permissions API not supported (Safari, older browsers)
        setState((prev) => ({ ...prev, permission: "prompt" }));
      });
    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener("change", handlePermissionChange);
      }
    };
  }, []);

  const getLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      const error = "Geolocation not supported by your browser";
      setState((prev) => ({ ...prev, error, loading: false }));
      onError?.(error);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // Validate coordinates are reasonable
        if (
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          const error = "Invalid coordinates received from GPS";
          setState((prev) => ({ ...prev, error, loading: false }));
          onError?.(error);
          return;
        }

        // Optional: Validate coordinates are within Karachi bounds
        if (validateKarachi) {
          if (
            latitude < KARACHI_BOUNDS.minLat ||
            latitude > KARACHI_BOUNDS.maxLat ||
            longitude < KARACHI_BOUNDS.minLng ||
            longitude > KARACHI_BOUNDS.maxLng
          ) {
            const error =
              "You appear to be outside Karachi. Results may be less relevant.";
            setState({
              latitude,
              longitude,
              accuracy,
              loading: false,
              error, // Still set location but show warning
              permission: state.permission,
            });
            onSuccess?.(latitude, longitude); // Still call success
            return;
          }
        }

        setState({
          latitude,
          longitude,
          accuracy,
          loading: false,
          error: null,
          permission: state.permission,
        });

        onSuccess?.(latitude, longitude);
      },
      (error) => {
        let errorMessage: string;

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location access denied. Please enable location permissions in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage =
              "Location information unavailable. Please check your GPS is enabled.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
          default:
            errorMessage =
              "An unknown error occurred while getting your location.";
        }

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          loading: false,
        }));

        onError?.(errorMessage);
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      },
    );
  }, [
    enableHighAccuracy,
    timeout,
    maximumAge,
    validateKarachi,
    onSuccess,
    onError,
    state.permission,
  ]);

  const reset = useCallback(() => {
    setState({
      latitude: null,
      longitude: null,
      accuracy: null,
      loading: false,
      error: null,
      permission: state.permission,
    });
  }, [state.permission]);

  return {
    ...state,
    getLocation,
    reset,
    isSupported: "geolocation" in navigator,
  };
}
