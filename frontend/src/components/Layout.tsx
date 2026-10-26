import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `nav-link${isActive ? " nav-link-active" : ""}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(() => window.innerWidth < 720);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const headerInnerRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const authRef = useRef<HTMLDivElement>(null);

  // O menu só aparece quando o navbar deixa de caber no ecrã.
  useLayoutEffect(() => {
    const inner = headerInnerRef.current;
    const brand = brandRef.current;
    const nav = navRef.current;
    const theme = themeRef.current;
    const auth = authRef.current;
    if (!inner || !brand || !nav || !theme || !auth) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const style = getComputedStyle(inner);
        const padding =
          parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const gap = parseFloat(style.columnGap || style.gap) || 0;
        const actionsStyle = getComputedStyle(auth.parentElement!);
        const actionsGap =
          parseFloat(actionsStyle.columnGap || actionsStyle.gap) || 0;
        const available = inner.clientWidth - padding;
        const needed =
          brand.offsetWidth +
          nav.scrollWidth +
          theme.offsetWidth +
          auth.offsetWidth +
          actionsGap +
          gap * 2;
        const shouldCompact = needed > available + 1;

        setCompact(shouldCompact);
        if (!shouldCompact) setMenuOpen(false);
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    observer.observe(nav);
    observer.observe(theme);
    observer.observe(auth);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    measure();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [user]);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  function handleLogout() {
    logout();
    navigate("/");
    setMenuOpen(false);
  }

  const roleLabel = user?.role === "auctioneer" ? "Leiloeiro" : "Licitante";

  return (
    <>
      <header className={`header${compact ? " header-compact" : ""}`}>
        <div className="header-inner" ref={headerInnerRef}>
          <Link
            to="/"
            className="brand"
            ref={brandRef}
            onClick={() => setMenuOpen(false)}
          >
            <span className="brand-mark">CL</span>
            <span className="brand-copy">
              <span className="brand-text">Casa de Leilões</span>
              <span className="brand-tag">Arte · ao vivo</span>
            </span>
          </Link>

          <nav
            className="nav nav-desktop"
            aria-label="Navegação principal"
            ref={navRef}
          >
            <NavLink to="/" end className={linkClass}>
              <span className="nav-icon"><Icon name="gallery" size={15} /></span> Vitrine
            </NavLink>
            {user?.role === "auctioneer" && (
              <NavLink to="/panel" className={linkClass}>
                <span className="nav-icon"><Icon name="gavel" size={15} /></span> Painel
              </NavLink>
            )}
            {user?.role === "bidder" && (
              <NavLink to="/my/bids" className={linkClass}>
                <span className="nav-icon"><Icon name="trophy" size={15} /></span> Meus arremates
              </NavLink>
            )}
            {user && (
              <NavLink to="/wallet" className={linkClass}>
                <span className="nav-icon"><Icon name="wallet" size={15} /></span> Carteira
              </NavLink>
            )}
          </nav>

          <div className="nav-actions">
            <div className="nav-theme" ref={themeRef}>
              <ThemeToggle />
            </div>

            <div className="nav-auth" ref={authRef}>
              {user ? (
                <div className="user-pill">
                  <span className="user-avatar" aria-hidden>
                    {user.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="user-meta">
                    <span className="user-name">{user.name.split(" ")[0]}</span>
                    <span className="user-role">{roleLabel}</span>
                  </span>
                  <button className="btn btn-sm btn-ghost user-logout" onClick={handleLogout}>
                    Sair
                  </button>
                </div>
              ) : (
                <Link to="/login" className="btn btn-sm btn-primary">
                  Entrar
                </Link>
              )}
            </div>

            <button
              ref={menuButtonRef}
              className="btn btn-sm btn-ghost hamburger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <Icon name="x" size={17} /> : <Icon name="grid" size={17} />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <nav className="mobile-menu" aria-label="Menu móvel" ref={menuRef}>
          {user && (
            <div className="mobile-user">
              <span className="user-avatar" aria-hidden>
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{user.name}</strong>
                <span className="muted">{roleLabel}</span>
              </div>
            </div>
          )}
          <NavLink to="/" end className="mobile-link" onClick={() => setMenuOpen(false)}>
            <Icon name="gallery" size={16} /> Vitrine
          </NavLink>
          {user?.role === "auctioneer" && (
            <NavLink to="/panel" className="mobile-link" onClick={() => setMenuOpen(false)}>
              <Icon name="gavel" size={16} /> Painel
            </NavLink>
          )}
          {user?.role === "bidder" && (
            <NavLink to="/my/bids" className="mobile-link" onClick={() => setMenuOpen(false)}>
              <Icon name="trophy" size={16} /> Meus arremates
            </NavLink>
          )}
          {user && (
            <NavLink to="/wallet" className="mobile-link" onClick={() => setMenuOpen(false)}>
              <Icon name="wallet" size={16} /> Carteira
            </NavLink>
          )}
          {user ? (
            <button className="mobile-link mobile-link-btn" onClick={handleLogout}>
              <Icon name="logout" size={16} /> Sair da conta
            </button>
          ) : (
            <NavLink to="/login" className="mobile-link" onClick={() => setMenuOpen(false)}>
              <Icon name="key" size={16} /> Entrar
            </NavLink>
          )}
        </nav>
      )}

      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">
        <p>
          Casa de Leilões &copy; {new Date().getFullYear()} · Arte do Art Institute of
          Chicago
        </p>
      </footer>
    </>
  );
}
