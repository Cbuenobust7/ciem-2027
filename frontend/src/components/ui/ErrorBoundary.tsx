import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/** Evita que un error de una ruta o chunk deje el SPA completamente en blanco. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de render de Marketplace Connect:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-master-navy">Algo salió mal</h1>
        <p className="mt-2 text-gray-600">
          Esta página no pudo cargarse. Puedes intentar recargarla o volver al inicio.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
          <a className="btn-secondary" href="/">
            Ir al inicio
          </a>
        </div>
      </main>
    )
  }
}
