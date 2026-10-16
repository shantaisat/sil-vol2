import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// False until .env is filled in. Pages check this and show a setup notice
// instead of crashing.
export const isConfigured = Boolean(url && key) && !url.includes("your-project");

// "Remember me": keep the session in localStorage (stays signed in) or in
// sessionStorage (signed out when the tab closes).
const REMEMBER_KEY = "silvol.remember";

export function setRemember(value) {
  try {
    localStorage.setItem(REMEMBER_KEY, String(Boolean(value)));
  } catch {
    /* storage unavailable: fall back to the default */
  }
}

function remembered() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  } catch {
    return true;
  }
}

const storage = {
  getItem: (k) => sessionStorage.getItem(k) ?? localStorage.getItem(k),
  setItem: (k, v) => {
    const [use, other] = remembered()
      ? [localStorage, sessionStorage]
      : [sessionStorage, localStorage];
    other.removeItem(k);
    use.setItem(k, v);
  },
  removeItem: (k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  },
};

export const supabase = isConfigured
  ? createClient(url, key, { auth: { storage } })
  : null;
