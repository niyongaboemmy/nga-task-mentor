import React, { createContext, useContext, useEffect, useState } from "react";
import { updateThemePreference } from "../services/authService";

type Theme = "light" | "dark";
type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  resetTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>("light");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme from localStorage and apply immediately
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    const initialTheme = savedTheme === "dark" ? "dark" : "light";

    // Apply theme immediately to prevent flash
    applyTheme(initialTheme);

    setTheme(initialTheme);
    setIsInitialized(true);
  }, []);

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;

    // Tailwind dark mode: add 'dark' class for dark theme, remove for light
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Set color scheme for better OS integration
    root.style.colorScheme = theme;
  };

  // Apply theme changes and persist to localStorage
  useEffect(() => {
    if (!isInitialized) return;

    applyTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme, isInitialized]);

  // NGA desktop app: it keeps the desktop and all four NGA apps on one theme.
  // A switch made elsewhere arrives here, already saved to the MIS account, so
  // apply it without saving again. preventDefault tells the desktop this app
  // applied it itself.
  useEffect(() => {
    const onDesktopTheme = (e: Event) => {
      const next = (e as CustomEvent<{ theme?: string }>).detail?.theme;
      if (next !== "light" && next !== "dark") return;
      e.preventDefault();
      setTheme(next);
    };
    window.addEventListener("nga:set-theme", onDesktopTheme);
    return () => window.removeEventListener("nga:set-theme", onDesktopTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    // Persist to MIS (asynchronously)
    updateThemePreference(newTheme);
  };

  const handleSetTheme = (newTheme: Theme) => {
    if (newTheme === theme) return;
    setTheme(newTheme);
    // Persist to MIS (asynchronously)
    updateThemePreference(newTheme);
  };

  const resetTheme = () => {
    localStorage.removeItem("theme");
    setTheme("light");
    applyTheme("light");
  };

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, setTheme: handleSetTheme, resetTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
