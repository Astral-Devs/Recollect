import OptionsApp from "./OptionsApp";
import { createRoot } from "react-dom/client";


(function mount() {
  try {
    const el = document.getElementById("root");
    if (!el) throw new Error("#root not found");
    const root = createRoot(el);
    root.render(<OptionsApp />);
    console.log("[Recollect][options] mounted");
  } catch (e) {
    console.error("[Recollect][options] mount error:", e);
    const el = document.getElementById("root");
    if (el) (el as HTMLElement).textContent = "Failed to load Options. Check console.";
  }
})();

// Surface unhandled module errors
window.addEventListener("error", (ev) => {
  console.error("[Recollect][options] window error:", ev.error || ev.message);
});
window.addEventListener("unhandledrejection", (ev) => {
  console.error("[Recollect][options] unhandledrejection:", ev.reason);
});
