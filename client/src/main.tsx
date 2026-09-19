import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

// Bootstrap first, then our token layer, then the components that consume it.
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/tokens.css";
import "./styles/components.css";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { router } from "./routes/router";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element #root is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
);
