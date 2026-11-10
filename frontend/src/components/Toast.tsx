import { useEffect, useRef } from "react";
import Icon from "./Icon";

export type ToastTone = "ok" | "err" | "info";

export interface ToastMessage {
  text: string;
  tone?: ToastTone;
}

interface Props {
  message: ToastMessage | null;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 4500 }: Props) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => onCloseRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [message, duration]);

  if (!message) return null;

  const tone = message.tone ?? "info";

  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      <span className="toast-icon" aria-hidden>
        <Icon name={tone === "ok" ? "check" : tone === "err" ? "alert" : "dot"} size={16} />
      </span>
      <span className="toast-text">{message.text}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Fechar aviso">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
