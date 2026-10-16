// Small helpers shared by every page.

// Escape anything that came from a user before putting it into innerHTML.
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

export const ROLE_LABELS = {
  org_admin: "Organisation",
  teacher: "Teacher",
  student: "Student",
};

export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const firstName = (name = "") => name.trim().split(/\s+/)[0] || "there";

export const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

// ----- Icons (Feather-style strokes) ---------------------------------------
const ICONS = {
  dashboard:
    '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>',
};

export const icon = (name, cls = "sidebar-icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;

// ----- Messages -------------------------------------------------------------
const ALERT_CLASSES = {
  error: "alert-error",
  success: "alert-success",
  info: "alert-info",
};

// `el` is an empty <p class="hidden" data-form-message role="alert"> element.
export function showAlert(el, type, message) {
  if (!el) return;
  el.className = ALERT_CLASSES[type] ?? ALERT_CLASSES.info;
  el.textContent = message;
}

export function hideAlert(el) {
  if (!el) return;
  el.className = "hidden";
  el.textContent = "";
}

export function friendlyError(error) {
  const message = error?.message ?? String(error ?? "");
  if (error?.code === "23505") return "That email already has a pending invitation.";
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message))
    return "Please confirm your email address first. Check your inbox for the link.";
  if (/failed to fetch|networkerror|load failed/i.test(message))
    return "We couldn't reach the server. Check your connection and try again.";
  return message || "Something went wrong. Please try again.";
}

export const configNotice = `<div class="alert-error" role="alert">Supabase isn't configured yet. Copy <code>.env.example</code> to <code>.env</code>, add your project URL and anon key, then restart <code>npm run dev</code>.</div>`;

// ----- Dashboard building blocks -------------------------------------------
export const pageHeader = (title, subtitle = "") => `
  <div class="page-header">
    <div>
      <h2 class="page-title">${esc(title)}</h2>
      ${subtitle ? `<p class="page-subtitle">${esc(subtitle)}</p>` : ""}
    </div>
  </div>`;

export const statCard = (label, value) => `
  <div class="stat-card">
    <span class="stat-value">${esc(value)}</span>
    <span class="stat-label">${esc(label)}</span>
  </div>`;

export const emptyState = (title, text = "") => `
  <div class="empty-state">
    <div class="empty-title">${esc(title)}</div>
    ${text ? `<p class="text-xs">${esc(text)}</p>` : ""}
  </div>`;

// headers: string[]; rows: string[][] of already-escaped HTML cells.
export const dataTable = (headers, rows) => `
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  </div>`;

// Throw the first Supabase error from a set of query results.
export function check(...results) {
  for (const result of results) if (result.error) throw result.error;
}
