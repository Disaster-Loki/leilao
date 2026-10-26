import { formatRemaining } from "../lib/utils";
import { useServerNow } from "../lib/use-server-now";

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
