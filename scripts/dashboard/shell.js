// The layout shared by every dashboard: sidebar, top bar and a hash-based router.
//
//   mountDashboard({
//     role: "teacher",
//     nav:  [{ id: "overview", label: "Dashboard", icon: "dashboard" }, ...],
//     views: { overview: async (ctx) => { ... } },
//   })
//
// A view receives { profile, el, reload, setUserName } and fills `el`.

import { supabase, isConfigured } from "../lib/supabase.js";
import { goToLogin, requireRole, signOut, url, LOGIN_PAGE } from "../lib/auth.js";
import {
  ROLE_LABELS,
  configNotice,
  esc,
  friendlyError,
  icon,
  initials,
} from "../lib/ui.js";

export async function mountDashboard({ role, nav, views }) {
  const app = document.getElementById("app");
  const defaultView = nav[0].id;

  if (!isConfigured) {
    app.innerHTML = `<div class="auth-shell"><div class="auth-card">${configNotice}</div></div>`;
    return;
  }

  // Role protection. Signed-out visitors go to login and people with a different
  // role go to their own dashboard; in both cases this never resolves.
  let profile;
  try {
    profile = await requireRole(role);
  } catch (error) {
    app.innerHTML = `<div class="auth-shell"><div class="auth-card"><div class="alert-error" role="alert">${esc(friendlyError(error))}</div><a class="btn-secondary" href="${url(LOGIN_PAGE)}">Back to login</a></div></div>`;
    return;
  }

  const navLinks = nav
    .map(
      (item) =>
        `<a href="#/${esc(item.id)}" class="sidebar-link" data-nav="${esc(item.id)}">${icon(item.icon)}${esc(item.label)}</a>`,
    )
    .join("");

  const subtitle = [ROLE_LABELS[profile.role], profile.organisation?.name]
    .filter(Boolean)
    .join(" · ");

  app.innerHTML = `
    <div class="dashboard-shell">
      <aside class="sidebar">
        <a href="${url("index.html")}" class="sidebar-brand">SILVOL</a>
        <nav class="flex flex-col gap-1" aria-label="Main">${navLinks}</nav>
        <div class="sidebar-spacer">
          <button type="button" class="sidebar-link w-full" data-logout>${icon("logout")}Log out</button>
        </div>
      </aside>

      <div class="dashboard-body">
        <header class="topbar">
          <h1 class="topbar-title" data-title></h1>
          <div class="topbar-user">
            <div class="hidden text-right sm:block">
              <div class="font-medium text-ink" data-user-name>${esc(profile.full_name)}</div>
              <div class="text-xs text-ink-muted">${esc(subtitle)}</div>
            </div>
            <span class="avatar" data-avatar>${esc(initials(profile.full_name))}</span>
            <button type="button" class="btn-text md:hidden" data-logout>Log out</button>
          </div>
        </header>

        <nav class="mobile-nav" aria-label="Main">${navLinks}</nav>

        <main class="dashboard-main" data-view></main>
      </div>
    </div>`;

  const viewHost = app.querySelector("[data-view]");
  const titleEl = app.querySelector("[data-title]");

  app.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () => signOut());
  });

  // Signing out in another tab signs this one out too.
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") goToLogin();
  });

  // Lets the profile view update the name in the top bar after saving.
  function setUserName(name) {
    app.querySelector("[data-user-name]").textContent = name;
    app.querySelector("[data-avatar]").textContent = initials(name);
  }

  let renderToken = 0;

  async function render() {
    const id = location.hash.replace(/^#\//, "") || defaultView;
    const item = nav.find((entry) => entry.id === id);

    // Unknown route: go to the default view (this triggers another hashchange).
    if (!item || !views[id]) {
      location.replace(`#/${defaultView}`);
      return;
    }

    app.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    titleEl.textContent = item.label;
    document.title = `${item.label} | SILVOL`;

    // Each render fills its own container, so a slow earlier view can never
    // overwrite a newer one.
    const token = ++renderToken;
    const el = document.createElement("div");
    el.className = "flex flex-col gap-6";
    viewHost.innerHTML = '<p class="loading">Loading…</p>';

    try {
      await views[id]({ profile, el, reload: render, setUserName });
    } catch (error) {
      console.error(error);
      el.innerHTML = `<div class="alert-error" role="alert">${esc(friendlyError(error))}</div>`;
    }

    if (token === renderToken) viewHost.replaceChildren(el);
  }

  window.addEventListener("hashchange", render);
  await render();
}
