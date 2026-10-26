import { useTheme } from "../lib/theme-context";

interface Props {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: Props) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "claro" : "escuro";

  return (
    <button
      type="button"
      className={`theme-toggle-btn${compact ? " theme-toggle-compact" : ""}`}
      onClick={toggle}
      aria-label={`Ativar modo ${next}`}
      title={`Ativar modo ${next}`}
    >
      <span className="theme-toggle-icons" aria-hidden>
        <span className={theme === "light" ? "on" : ""}>☀️</span>
        <span className={theme === "dark" ? "on" : ""}>🌙</span>
      </span>
      {!compact && <span className="theme-toggle-text"></span>}
    </button>
  );
}
