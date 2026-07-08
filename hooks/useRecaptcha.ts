"use client";

import { useCallback, useRef, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      execute: (
        siteKey: string,
        options?: { action?: string }
      ) => Promise<string>;
      ready: (callback: () => void) => void;
    };
    __recaptchaLoadPromise?: Promise<void>;
  }
}

/**
 * Lazy-loading reCAPTCHA hook.
 * The script is NOT loaded on mount - call loadRecaptcha() when user interacts with a form.
 * This saves ~362KB initial download and ~400ms main thread time on pages with forms.
 */
export function useRecaptcha(siteKey?: string) {
  const [isReady, setIsReady] = useState(false);
  const loadingRef = useRef(false);

  /**
   * Load the reCAPTCHA script on demand.
   * Safe to call multiple times - will only load once.
   * Returns a promise that resolves when reCAPTCHA is ready.
   */
  const loadRecaptcha = useCallback((): Promise<void> => {
    // Return existing promise if already loading/loaded
    if (window.__recaptchaLoadPromise) {
      return window.__recaptchaLoadPromise;
    }

    // Already loaded and ready
    if (window.grecaptcha?.execute) {
      setIsReady(true);
      return Promise.resolve();
    }

    // Prevent duplicate loading
    if (loadingRef.current) {
      return Promise.resolve();
    }

    if (!siteKey || typeof window === "undefined") {
      return Promise.resolve();
    }

    loadingRef.current = true;

    // Create and store the load promise globally to prevent duplicate loads
    window.__recaptchaLoadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (window.grecaptcha?.ready) {
          window.grecaptcha.ready(() => {
            setIsReady(true);
            resolve();
          });
        } else {
          // Fallback: poll for grecaptcha
          const checkReady = setInterval(() => {
            if (window.grecaptcha?.execute) {
              clearInterval(checkReady);
              setIsReady(true);
              resolve();
            }
          }, 100);
          // Timeout after 10 seconds - reject and reset the cached promise so callers can retry
          setTimeout(() => {
            if (!window.grecaptcha?.execute) {
              clearInterval(checkReady);
              window.__recaptchaLoadPromise = undefined;
              loadingRef.current = false;
              reject(new Error("reCAPTCHA load timeout"));
            }
          }, 10000);
        }
      };

      script.onerror = () => {
        console.warn("Failed to load reCAPTCHA script");
        loadingRef.current = false;
        window.__recaptchaLoadPromise = undefined;
        reject(new Error("Failed to load reCAPTCHA script"));
      };

      document.head.appendChild(script);
    });

    return window.__recaptchaLoadPromise;
  }, [siteKey]);

  /**
   * Execute reCAPTCHA and get a token.
   * Will auto-load the script if not already loaded.
   */
  const executeRecaptcha = useCallback(
    async (action?: string): Promise<string | null> => {
      if (!siteKey) {
        console.warn("reCAPTCHA site key not provided");
        return null;
      }

      // Ensure script is loaded
      await loadRecaptcha();

      if (!window.grecaptcha?.execute) {
        console.warn("reCAPTCHA not available after loading");
        return null;
      }

      try {
        const token = await window.grecaptcha.execute(siteKey, {
          action: action || "submit",
        });
        return token;
      } catch (error) {
        console.warn("reCAPTCHA execution failed:", error);
        return null;
      }
    },
    [siteKey, loadRecaptcha]
  );

  return {
    executeRecaptcha,
    loadRecaptcha,
    isReady,
  };
}
