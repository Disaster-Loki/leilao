import { useEffect, useState } from "react";

export function useServerNow(serverNowIso: string) {
  const [offsetMs, setOffsetMs] = useState(
    () => new Date(serverNowIso).getTime() - Date.now()
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refreshOffset = () => {
      setOffsetMs(new Date(serverNowIso).getTime() - Date.now());
    };

    const timer = setInterval(() => {
      setNow(Date.now());
      refreshOffset();
    }, 60000);

    const onVisible = () => {
      setNow(Date.now());
      refreshOffset();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [serverNowIso]);

  return now + offsetMs;
}
