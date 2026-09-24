import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "./index.css";
import App from "./App.jsx";
import { installTenantHeaders } from "./utils/tenantHeaders";
import { rehydrateSession } from "./utils/authApi";
import { getTenantSubdomain } from "./utils/hostAccess";

installTenantHeaders();

const render = () =>
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

// Rehydrate before first render so route guards see the user; only on tenant hosts.
const needsRehydrate = getTenantSubdomain() && !localStorage.getItem("user");
(needsRehydrate ? rehydrateSession() : Promise.resolve()).finally(render);
