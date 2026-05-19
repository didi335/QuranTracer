import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/* Swallow benign "ResizeObserver loop" warnings so they don't trigger
   the Vite runtime-error overlay (which would block the whole UI). */
const isResizeObserverLoopError = (msg: unknown) =>
  typeof msg === "string" &&
  (msg.includes("ResizeObserver loop completed with undelivered notifications") ||
    msg.includes("ResizeObserver loop limit exceeded"));

window.addEventListener("error", (e) => {
  if (isResizeObserverLoopError(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason as { message?: string } | string | undefined;
  const msg = typeof reason === "string" ? reason : reason?.message;
  if (isResizeObserverLoopError(msg)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
