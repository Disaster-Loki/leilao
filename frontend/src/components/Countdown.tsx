import { useEffect, useState } from "react";
import { formatRemaining } from "../lib/utils";

export function useServerNow(serverNowIso: string) {
  // offset = diferença entre hora do servidor e hora do cliente
  // assim a contagem usa sempre a hora do servidor
  const [offsetMs] = useState(() => new Date(serverNowIso).getTime() - Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return now + offsetMs;
}

interface Props {
  endAt: string;
  serverNow: string;
}

export default function Countdown({ endAt, serverNow }: Props) {
  const now = useServerNow(serverNow);
  const left = new Date(endAt).getTime() - now;
  const urgent = left > 0 && left <= 2 * 60 * 1000;
  return (
    <span className={urgent ? "countdown urgent" : "countdown"}>
      {left > 0 ? formatRemaining(left) : "Encerrado"}
    </span>
  );
}
