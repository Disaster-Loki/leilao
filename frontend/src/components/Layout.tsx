import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../lib/useTheme";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
    setMenuOpen(false);
  }

  return (
    <>
      <header className="header">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon">🏛</span>
          <span className="brand-text">Casa de Leilões</span>
        </Link>

        {/* Desktop nav */}
        <nav className="nav nav-desktop">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}>
            Vitrine
          </NavLink>
          {user?.role === "auctioneer" && (
            <NavLink to="/panel" className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}>
              Painel
            </NavLink>
          )}
          {user?.role === "bidder" && (
            <NavLink to="/my/bids" className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}>
              Meus Arremates
            </NavLink>
          )}
          {user && (
            <NavLink to="/wallet" className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}>
              Carteira
            </NavLink>
          )}
        </nav>

        <div className="nav-actions">
          <button
            className="btn btn-sm btn-ghost theme-toggle"
            onClick={toggle}
            aria-label="Alternar tema"
            title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {user ? (
            <div className="user-pill">
              <span className="user-role-badge">
                {user.role === "auctioneer" ? "🔨" : "🙋"}
              </span>
              <span className="user-name">{user.name.split(" ")[0]}</span>
              <button className="btn btn-sm btn-ghost" onClick={handleLogout}>
                Sair
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-sm btn-primary">
              Entrar
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            className="btn btn-sm btn-ghost hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <nav className="mobile-menu">
          <NavLink to="/" end className="mobile-link" onClick={() => setMenuOpen(false)}>🏠 Vitrine</NavLink>
          {user?.role === "auctioneer" && (
            <NavLink to="/panel" className="mobile-link" onClick={() => setMenuOpen(false)}>🔨 Painel</NavLink>
          )}
          {user?.role === "bidder" && (
            <NavLink to="/my/bids" className="mobile-link" onClick={() => setMenuOpen(false)}>🏆 Meus Arremates</NavLink>
          )}
          {user && (
            <NavLink to="/wallet" className="mobile-link" onClick={() => setMenuOpen(false)}>💰 Carteira</NavLink>
          )}
          {user ? (
            <button className="mobile-link mobile-link-btn" onClick={handleLogout}>🚪 Sair</button>
          ) : (
            <NavLink to="/login" className="mobile-link" onClick={() => setMenuOpen(false)}>🔑 Entrar</NavLink>
          )}
        </nav>
      )}

      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">
        <p>Casa de Leilões &copy; {new Date().getFullYear()} &middot; Arte do Art Institute of Chicago</p>
      </footer>
    </>
  );
}

