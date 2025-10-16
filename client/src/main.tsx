import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const initializeAppSettings = () => {
  const storedTextSize = localStorage.getItem("textSize") as "small" | "medium" | "large" | null;
  if (storedTextSize) {
    document.documentElement.style.setProperty(
      "--text-scale",
      storedTextSize === "small" ? "0.875" : storedTextSize === "large" ? "1.125" : "1"
    );
  }
  
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "dark") {
    document.documentElement.classList.add("dark");
  }
};

initializeAppSettings();

createRoot(document.getElementById("root")!).render(<App />);
