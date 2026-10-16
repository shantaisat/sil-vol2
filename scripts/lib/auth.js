import { supabase } from "./supabase.js";

// Paths are resolved against Vite's base URL so the app also works when it is
// deployed in a sub-folder.
export const url = (path) => import.meta.env.BASE_URL + path.replace(/^\//, "");
export const absoluteUrl = (path) => new URL(url(path), location.origin).href;

export const LOGIN_PAGE = "pages/login.html";

// Each role has its own dashboard page.
export const ROLE_HOME = {
  org_admin: "pages/org-dashboard.html",
  teacher: "pages/teacher-dashboard.html",
  student: "pages/student-dashboard.html",
};

export const homeFor = (role) => url(ROLE_HOME[role] ?? LOGIN_PAGE);

// Returned by guards after they start a redirect, so the calling code never
// carries on rendering a page the visitor is not allowed to see.
const halt = () => new Promise(() => {});

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// The signed-in user's profile, with their organisation and teacher attached.
//
// These are three plain queries rather than one joined query on purpose: a joined
// select (e.g. "teacher:profiles!fk(...)") only works when PostgREST's schema
// cache knows the foreign key, and fails with "Could not find a relationship"
// when it doesn't. Row-level security still decides what each query can see.
export async function fetchProfile(userId) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  const [organisation, teacher] = await Promise.all([
    profile.organisation_id
      ? supabase.from("organisations").select("id, name").eq("id", profile.organisation_id).maybeSingle()
      : { data: null, error: null },
    profile.teacher_id
      ? supabase.from("profiles").select("id, full_name, email").eq("id", profile.teacher_id).maybeSingle()
      : { data: null, error: null },
  ]);
  if (organisation.error) throw organisation.error;
  if (teacher.error) throw teacher.error;

  return { ...profile, organisation: organisation.data, teacher: teacher.data };
}

// Dashboard guard: signed out -> login, wrong role -> their own dashboard.
export async function requireRole(role) {
  const session = await getSession();
  if (!session) {
    location.replace(url(LOGIN_PAGE));
    return halt();
  }

  const profile = await fetchProfile(session.user.id);
  if (!profile || !ROLE_HOME[profile.role]) {
    await supabase.auth.signOut();
    location.replace(`${url(LOGIN_PAGE)}?error=no-profile`);
    return halt();
  }

  if (profile.role !== role) {
    location.replace(homeFor(profile.role));
    return halt();
  }

  return profile;
}

// Login / sign-up pages: skip them when already signed in.
export async function redirectIfSignedIn() {
  const session = await getSession();
  if (!session) return;
  const profile = await fetchProfile(session.user.id);
  if (profile && ROLE_HOME[profile.role]) location.replace(homeFor(profile.role));
}

// Go to the login page once. Signing out fires both the button handler and the
// SIGNED_OUT listener, and two redirects would cancel each other.
let leaving = false;
export function goToLogin() {
  if (leaving) return;
  leaving = true;
  location.replace(url(LOGIN_PAGE));
}

export async function signOut() {
  await supabase.auth.signOut();
  goToLogin();
}
