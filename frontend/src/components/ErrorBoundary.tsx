import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Silencioso: a UI mostra o erro e permite recarregar.
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="container">
        <div className="card" style={{ padding: "2rem", marginTop: "2rem" }}>
          <h1>Não foi possível carregar a página</h1>
          <p className="muted" style={{ margin: ".5rem 0 1rem" }}>
            Verifique a ligação à API e tente novamente.
          </p>
          <details style={{ marginBottom: "1rem" }}>
            <summary className="muted">Detalhes técnicos</summary>
            <pre className="mono" style={{ whiteSpace: "pre-wrap", marginTop: ".5rem" }}>
              {this.state.error.message}
            </pre>
          </details>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
