import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import App from "./App.tsx";
import { migrateFromLocalStorage } from "./utils/imageDB";

// One-time migration from localStorage to IndexedDB
migrateFromLocalStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
