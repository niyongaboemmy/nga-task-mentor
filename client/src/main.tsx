import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SchemeOfWorkProvider } from "./contexts/SchemeOfWorkContext";
import { CourseCacheProvider } from "./contexts/CourseCacheContext";
import { store } from "./store";
import "./index.css";
import App from "./App.tsx";
import { initNgaInstall, NgaInstallPrompt } from "./pwa/ngaInstall";

// Installable app + "install this too" when opened from the installed NGA app.
initNgaInstall();

createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <ThemeProvider>
      <AuthProvider>
        <CourseCacheProvider>
          <SchemeOfWorkProvider>
            <App />
            <NgaInstallPrompt appName="Task Mentor" accent="#3b82f6" />
          </SchemeOfWorkProvider>
        </CourseCacheProvider>
      </AuthProvider>
    </ThemeProvider>
  </Provider>,
);
