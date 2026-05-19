import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  /** Optional label used in console logs to identify which boundary tripped. */
  scope?: string;
  /** Render-prop for the user-facing fallback. Receives the error message. */
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Lightweight error boundary used to wrap Gemini / Drive / camera features.
 * On render failure inside `children`, it logs a tagged warning to the
 * console (so it shows up in Railway / Sentry-style log scrapers) and renders
 * `fallback` instead of letting the whole route crash.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const tag = `[BOUNDARY:${this.props.scope ?? "unknown"}]`;
    console.error(tag, error.message, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
