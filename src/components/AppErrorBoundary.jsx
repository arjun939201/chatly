import React from "react";

export default class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Chatly UI crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--app-bg, #f5f5f7)", color: "var(--text, #17171b)", fontFamily: "system-ui, sans-serif" }}>
          <section style={{ width: "min(100%, 420px)", textAlign: "center", padding: 28, border: "1px solid var(--border, #e4e4e9)", borderRadius: 18, background: "var(--surface, #fff)" }}>
            <h1 style={{ margin: "0 0 10px", fontSize: 22 }}>Something went wrong</h1>
            <p style={{ margin: "0 0 20px", lineHeight: 1.6, color: "var(--muted, #70707a)" }}>Chatly couldn’t display this screen. You can try again or reload the app.</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => this.setState({ hasError: false })} style={{ minHeight: 42, padding: "0 16px", borderRadius: 10, border: "1px solid var(--border, #e4e4e9)", background: "transparent", color: "inherit", font: "inherit", cursor: "pointer" }}>Try again</button>
              <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 42, padding: "0 16px", borderRadius: 10, border: 0, background: "var(--text, #17171b)", color: "var(--surface, #fff)", font: "inherit", cursor: "pointer" }}>Reload app</button>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
