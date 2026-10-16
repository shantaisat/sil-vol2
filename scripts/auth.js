// Behaviour for the login, sign-up, forgot-password and reset-password pages.

import { supabase, isConfigured, setRemember } from "./lib/supabase.js";
import {
  absoluteUrl,
  fetchProfile,
  homeFor,
  redirectIfSignedIn,
  LOGIN_PAGE,
} from "./lib/auth.js";
import { configNotice, friendlyError, hideAlert, showAlert } from "./lib/ui.js";

const signupForm = document.querySelector('[data-auth-form="signup"]');
const loginForm = document.querySelector('[data-auth-form="login"]');
const forgotForm = document.querySelector('[data-auth-form="forgot"]');
const resetForm = document.querySelector('[data-auth-form="reset"]');
const forms = [signupForm, loginForm, forgotForm, resetForm].filter(Boolean);

// ----- Show / hide password --------------------------------------------------
document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  const input = document.getElementById(button.dataset.togglePassword);
  if (!input) return;

  button.addEventListener("click", () => {
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });
});

// ----- Helpers ---------------------------------------------------------------
const messageOf = (form) => form.querySelector("[data-form-message]");

function setBusy(form, busy, busyLabel = "Please wait…") {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.disabled = busy;
}

const markInvalid = (input, invalid) => input.classList.toggle("form-input-error", invalid);

// ----- Setup notice + "already signed in" redirect ---------------------------
if (!isConfigured) {
  forms.forEach((form) => form.insertAdjacentHTML("afterbegin", configNotice));
} else if (!resetForm) {
  redirectIfSignedIn().catch(() => {});
}

// Social buttons (Google / Microsoft / Apple). They work once the provider is
// enabled in the Supabase dashboard: Authentication -> Providers.
document.querySelectorAll("[data-oauth]").forEach((button) => {
  button.addEventListener("click", async () => {
    const form = signupForm ?? loginForm;
    const message = form && messageOf(form);
    hideAlert(message);

    if (!isConfigured) return showAlert(message, "error", "Supabase isn't configured yet.");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: button.dataset.oauth,
      options: { redirectTo: absoluteUrl(LOGIN_PAGE) },
    });
    if (error) {
      showAlert(
        message,
        "error",
        "That sign-in method isn't enabled for this project yet. Please use your email and password.",
      );
    }
  });
});

// ----- Sign up ---------------------------------------------------------------
if (signupForm) {
  // ?type=organisation switches the form to "register an organisation".
  const isOrg = new URLSearchParams(location.search).get("type") === "organisation";
  const message = messageOf(signupForm);
  const password = signupForm.querySelector("#password");
  const confirm = signupForm.querySelector("#confirm-password");
  const terms = signupForm.querySelector("#terms");
  const orgName = signupForm.querySelector("#organisation-name");
  const confirmError = document.getElementById("confirm-error");
  const termsError = document.getElementById("terms-error");

  document
    .querySelectorAll("[data-org-only]")
    .forEach((el) => el.classList.toggle("hidden", !isOrg));
  document
    .querySelectorAll("[data-member-only]")
    .forEach((el) => el.classList.toggle("hidden", isOrg));

  if (isOrg) {
    document.querySelector("[data-signup-title]").textContent = "Register your organisation";
    document.querySelector("[data-signup-subtitle]").textContent =
      "Create an organisation account to invite teachers and manage learners.";
    document.title = "Register your organisation | SILVOL";
    if (orgName) orgName.required = true;
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert(message);

    const mismatch = password.value !== confirm.value;
    markInvalid(confirm, mismatch);
    confirmError.classList.toggle("hidden", !mismatch);

    const noTerms = !terms.checked;
    termsError.classList.toggle("hidden", !noTerms);

    // Native checks (required fields, email format, 8+ character password)
    if (!signupForm.checkValidity() || mismatch || noTerms) {
      signupForm.reportValidity();
      return;
    }

    if (!isConfigured) return showAlert(message, "error", "Supabase isn't configured yet.");

    setBusy(signupForm, true, "Creating account…");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupForm.email.value.trim(),
        password: password.value,
        options: {
          emailRedirectTo: absoluteUrl(LOGIN_PAGE),
          // The role is NOT sent from here. The database decides it
          // (see supabase/schema.sql: handle_new_user).
          data: {
            full_name: signupForm.full_name.value.trim(),
            account_type: isOrg ? "organisation" : "member",
            organisation_name: isOrg ? orgName.value.trim() : null,
          },
        },
      });

      if (error) throw error;

      // Supabase hides "email already registered" by returning a user with no identities.
      if (data.user && data.user.identities?.length === 0) {
        showAlert(message, "error", "An account with this email already exists. Try logging in instead.");
        return;
      }

      if (data.session) {
        const profile = await fetchProfile(data.user.id);
        location.replace(homeFor(profile?.role));
        return;
      }

      // Email confirmation is switched on: ask them to check their inbox.
      signupForm.reset();
      showAlert(
        message,
        "success",
        "Almost there! We've sent a confirmation link to your email. Click it, then log in.",
      );
    } catch (error) {
      showAlert(message, "error", friendlyError(error));
    } finally {
      setBusy(signupForm, false);
    }
  });
}

// ----- Login -----------------------------------------------------------------
if (loginForm) {
  const message = messageOf(loginForm);

  if (new URLSearchParams(location.search).get("error") === "no-profile") {
    showAlert(message, "error", "We couldn't find a profile for that account. Please contact support.");
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert(message);

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;
    if (!email || !password) {
      return showAlert(message, "error", "Please enter your email and password.");
    }
    if (!isConfigured) return showAlert(message, "error", "Supabase isn't configured yet.");

    setRemember(loginForm.remember.checked);
    setBusy(loginForm, true, "Logging in…");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Send each person to the dashboard for their role.
      const profile = await fetchProfile(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        throw new Error("We couldn't find a profile for that account. Please contact support.");
      }
      location.replace(homeFor(profile.role));
    } catch (error) {
      showAlert(message, "error", friendlyError(error));
      setBusy(loginForm, false);
    }
  });
}

// ----- Forgot password -------------------------------------------------------
if (forgotForm) {
  const message = messageOf(forgotForm);

  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert(message);

    const email = forgotForm.email.value.trim();
    if (!email) return showAlert(message, "error", "Please enter your email address.");
    if (!isConfigured) return showAlert(message, "error", "Supabase isn't configured yet.");

    setBusy(forgotForm, true, "Sending…");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: absoluteUrl("pages/reset-password.html"),
      });
      if (error) throw error;
      // Same message whether or not the email has an account.
      showAlert(message, "success", "If an account exists for that email, a reset link is on its way.");
    } catch (error) {
      showAlert(message, "error", friendlyError(error));
    } finally {
      setBusy(forgotForm, false);
    }
  });
}

// ----- Reset password (arrives from the emailed link) ------------------------
if (resetForm) {
  const message = messageOf(resetForm);
  const password = resetForm.querySelector("#password");
  const confirm = resetForm.querySelector("#confirm-password");
  let ready = false;

  if (isConfigured) {
    // The recovery link signs the visitor in; no session means a bad or expired link.
    supabase.auth.getSession().then(({ data }) => {
      ready = Boolean(data.session);
      if (!ready) {
        showAlert(message, "error", "This reset link is invalid or has expired. Please request a new one.");
      }
    });
  }

  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert(message);

    if (!isConfigured) return showAlert(message, "error", "Supabase isn't configured yet.");
    if (!ready) {
      return showAlert(message, "error", "This reset link is invalid or has expired. Please request a new one.");
    }
    if (password.value.length < 8) {
      return showAlert(message, "error", "Your password needs at least 8 characters.");
    }
    if (password.value !== confirm.value) {
      return showAlert(message, "error", "Passwords do not match.");
    }

    setBusy(resetForm, true, "Saving…");
    try {
      const { data, error } = await supabase.auth.updateUser({ password: password.value });
      if (error) throw error;

      const profile = await fetchProfile(data.user.id);
      location.replace(homeFor(profile?.role));
    } catch (error) {
      showAlert(message, "error", friendlyError(error));
      setBusy(resetForm, false);
    }
  });
}
