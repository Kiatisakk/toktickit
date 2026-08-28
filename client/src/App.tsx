import { useState } from "react";

import { fetchCategories, fetchHealth, type Category } from "./api";

/**
 * System Status is a verdict about the whole vertical slice, not the result of
 * a single endpoint: Online means the API answered *and* the categories loaded
 * from PostgreSQL. See CONTEXT.md.
 */
type CheckState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "online"; categories: Category[] }
  | { kind: "offline"; message: string };

export default function App() {
  const [state, setState] = useState<CheckState>({ kind: "idle" });

  async function checkSystem() {
    setState({ kind: "loading" });

    try {
      await fetchHealth();
      const categories = await fetchCategories();
      setState({ kind: "online", categories });
    } catch (error) {
      setState({
        kind: "offline",
        message:
          error instanceof Error
            ? error.message
            : "Unable to connect to TokTickIT API",
      });
    }
  }

  return (
    <main className="container py-5" style={{ maxWidth: "48rem" }}>
      <h1 className="h3 mb-4">TokTickIT IT Service Desk</h1>

      <button
        type="button"
        className="btn btn-primary"
        onClick={checkSystem}
        disabled={state.kind === "loading"}
      >
        Check System
      </button>

      {state.kind === "loading" && (
        <p className="mt-4 mb-0" role="status">
          <span aria-hidden="true">⏳</span> Loading…
        </p>
      )}

      {state.kind === "online" && (
        <div className="mt-4">
          <p className="mb-4">
            System Status: <span className="badge text-bg-success">Online</span>
          </p>

          <h2 className="h5">Supported Request Categories</h2>
          <ol className="mb-0">
            {state.categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ol>
        </div>
      )}

      {state.kind === "offline" && (
        <div className="mt-4">
          <p className="mb-2">
            System Status: <span className="badge text-bg-danger">Offline</span>
          </p>
          <div className="alert alert-danger mb-0" role="alert">
            {state.message}
          </div>
        </div>
      )}
    </main>
  );
}
