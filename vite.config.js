import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Every HTML page must be listed here so `npm run build` includes it.
// (`npm run dev` serves any page automatically.)
const page = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Multi-page app: unknown URLs return a 404 instead of falling back to index.html.
  appType: "mpa",
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: page("./index.html"),
        login: page("./pages/login.html"),
        signup: page("./pages/signup.html"),
        forgotPassword: page("./pages/forgot-password.html"),
        resetPassword: page("./pages/reset-password.html"),
        orgDashboard: page("./pages/org-dashboard.html"),
        teacherDashboard: page("./pages/teacher-dashboard.html"),
        studentDashboard: page("./pages/student-dashboard.html"),
      },
    },
  },
});
