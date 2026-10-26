import { useEffect, useState } from "react";

/**
 * Relógio alinhado com o servidor.
 * offset = diferença entre a hora do servidor e a hora do cliente, para a
 * contagem regressiva não depender do relógio (possivelmente errado) do browser.
 */
export function useServerNow(serverNowIso: string) {
  const [offsetMs] = useState(
    () => new Date(serverNowIso).getTime() - Date.now()
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  return now + offsetMs;
}
