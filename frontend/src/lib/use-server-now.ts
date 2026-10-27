import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

export function useServerNow(initialServerNowIso: string) {
  const initialServerEpoch = new Date(initialServerNowIso).getTime();
  const anchor = useRef<{ serverEpochAtSync: number; performanceAtSync: number } | null>(null);
  const [serverNow, setServerNow] = useState(initialServerEpoch);

  useEffect(() => {
    let active = true;

    anchor.current = {
      serverEpochAtSync: initialServerEpoch,
      performanceAtSync: performance.now(),
    };

    const updateServerNow = () => {
      const current = anchor.current;
      if (!current) return;
      setServerNow(current.serverEpochAtSync + (performance.now() - current.performanceAtSync));
    };

    const refreshOffset = async () => {
      const requestStart = performance.now();
      try {
        const { serverNow: serverNowIso } = await api<{ serverNow: string }>("/time");
        const responseEnd = performance.now();
        const serverEpochAtResponse = new Date(serverNowIso).getTime();
        if (!active || !Number.isFinite(serverEpochAtResponse)) return;

        // The DB timestamp is generated while handling this request; map it to the request midpoint.
        const roundTripMs = responseEnd - requestStart;
        anchor.current = {
          serverEpochAtSync: serverEpochAtResponse - roundTripMs / 2,
          performanceAtSync: requestStart + roundTripMs / 2,
        };
        updateServerNow();
      } catch {
        // Keep the API-provided lot.serverNow anchor if /time is unavailable.
      }
    };

    void refreshOffset();
    const syncTimer = setInterval(() => void refreshOffset(), 60000);
    const renderTimer = setInterval(updateServerNow, 1000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        updateServerNow();
        void refreshOffset();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      clearInterval(syncTimer);
      clearInterval(renderTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initialServerEpoch]);

  return serverNow;
}
