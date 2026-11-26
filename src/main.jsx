import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { registerSW } from "./lib/push";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/client.css";

import { SCRIPT_URL, DEMO_MODE } from "./config";

// si cambia el backend (demo → hoja real), limpiamos lo guardado del anterior
const BACKEND = SCRIPT_URL || (DEMO_MODE ? "demo" : "none");
if (localStorage.getItem("sf_backend") !== BACKEND) {
  Object.keys(localStorage).filter((k) => k.startsWith("sf_") && k !== "sf_client_v1").forEach((k) => localStorage.removeItem(k));
  localStorage.setItem("sf_backend", BACKEND);
}

registerSW();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
