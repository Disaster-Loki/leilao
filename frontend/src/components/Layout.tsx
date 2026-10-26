import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="header">
        <Link to="/" className="brand">
          <span className="brand-icon">🏛</span>
          <span>Casa de Leilões</span>
        </Link>
        <nav className="nav">
          <Link to="/" className="nav-link">Vitrine</Link>
          {user?.role === "auctioneer" && (
            <Link to="/panel" className="nav-link">Painel</Link>
          )}
          {user?.role === "bidder" && (
            <Link to="/my/bids" className="nav-link">Meus Arremates</Link>
          )}
          {user && <Link to="/wallet" className="nav-link">Carteira</Link>}
          {user ? (
            <div className="nav-user">
              <span className="user-name">{user.name}</span>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Sair
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-sm btn-primary">
              Entrar
            </Link>
          )}
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">
        <p>Casa de Leilões &copy; {new Date().getFullYear()}</p>
      </footer>
    </>
  );
}
