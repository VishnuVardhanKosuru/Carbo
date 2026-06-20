/**
 * ErrorBoundary — React class component that catches render-phase errors
 * and displays a graceful fallback UI instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */

import { Component } from "react";
import PropTypes from "prop-types";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    /** @type {{ hasError: boolean, error: Error|null }} */
    this.state = { hasError: false, error: null };
  }

  /**
   * Update state so the next render will show the fallback UI.
   *
   * @param {Error} error - The error that was thrown.
   * @returns {{ hasError: boolean, error: Error }}
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /**
   * Log error details for debugging.
   *
   * @param {Error}  error     - The thrown error.
   * @param {{ componentStack: string }} info - React component stack.
   */
  componentDidCatch(error, info) {
    // In production this would forward to an error-reporting service
    if (typeof window !== "undefined" && window.__CARBO_DEBUG__) {
      // eslint-disable-next-line no-console
      console.warn("[Carbo ErrorBoundary]", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="error-boundary-fallback"
        >
          <span className="error-boundary-icon" aria-hidden="true">
            🌿
          </span>
          <h2 className="error-boundary-title">Something went wrong</h2>
          <p className="error-boundary-msg">
            Carbo encountered an unexpected error. Please refresh the page to
            continue tracking your carbon footprint.
          </p>
          <button
            className="btn-primary"
            style={{ width: "auto", marginTop: "1rem" }}
            onClick={() => window.location.reload()}
          >
            🔄 Reload App
          </button>
          {process.env.NODE_ENV !== "production" && this.state.error && (
            <pre className="error-boundary-detail">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};
