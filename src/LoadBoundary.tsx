import { Component, Suspense, type ReactNode } from "react";
export default class LoadBoundary extends Component<
  { children: ReactNode; onClose?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="load-notice" role="alert">
          <p>
            Não foi possível abrir esta tela. Verifique sua conexão e recarregue
            a página.
          </p>
          <button className="btn primary" onClick={() => location.reload()}>
            Recarregar página
          </button>
          {this.props.onClose && (
            <button className="btn secondary" onClick={this.props.onClose}>
              Voltar
            </button>
          )}
        </div>
      );
    return (
      <Suspense
        fallback={
          <div className="load-notice" role="status">
            Carregando ferramenta…
          </div>
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
