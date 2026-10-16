// "Profile" view, shared by all three roles.

import { supabase } from "../lib/supabase.js";
import {
  ROLE_LABELS,
  esc,
  friendlyError,
  hideAlert,
  pageHeader,
  showAlert,
} from "../lib/ui.js";

export async function profileView({ profile, el, setUserName }) {
  const isOrg = profile.role === "org_admin";

  el.innerHTML = `
    ${pageHeader("My profile", "Keep your details up to date.")}

    <form class="panel" data-profile-form novalidate>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label" for="full-name">Full name</label>
          <input class="form-input" id="full-name" name="full_name" type="text"
            value="${esc(profile.full_name)}" autocomplete="name" maxlength="120" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="email">Email address</label>
          <input class="form-input" id="email" type="email" value="${esc(profile.email)}" disabled />
        </div>

        <div class="form-group">
          <label class="form-label" for="phone">Phone number</label>
          <input class="form-input" id="phone" name="phone" type="tel"
            value="${esc(profile.phone)}" autocomplete="tel" maxlength="40" />
        </div>

        <div class="form-group">
          <label class="form-label" for="location">Location</label>
          <input class="form-input" id="location" name="location" type="text"
            value="${esc(profile.location)}" maxlength="120" />
        </div>

        <div class="form-group form-grid-full">
          <label class="form-label" for="about">${isOrg ? "About us" : "About me"}</label>
          <textarea class="form-textarea" id="about" name="about" maxlength="1000">${esc(profile.about)}</textarea>
        </div>
      </div>

      <div class="detail-list">
        <div>
          <div class="detail-label">Account type</div>
          <div class="detail-value">${esc(ROLE_LABELS[profile.role])}</div>
        </div>
        <div>
          <div class="detail-label">Organisation</div>
          <div class="detail-value">${esc(profile.organisation?.name ?? "Not part of an organisation")}</div>
        </div>
      </div>

      <p class="hidden" data-form-message role="alert"></p>

      <div>
        <button type="submit" class="btn-primary">Save changes</button>
      </div>
    </form>`;

  const form = el.querySelector("[data-profile-form]");
  const message = form.querySelector("[data-form-message]");
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert(message);

    const fullName = form.full_name.value.trim();
    if (!fullName) return showAlert(message, "error", "Please enter your name.");

    const changes = {
      full_name: fullName,
      phone: form.phone.value.trim() || null,
      location: form.location.value.trim() || null,
      about: form.about.value.trim() || null,
    };

    button.disabled = true;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(changes)
        .eq("id", profile.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Your changes could not be saved.");

      Object.assign(profile, changes);
      setUserName(fullName);
      showAlert(message, "success", "Your profile has been saved.");
    } catch (error) {
      showAlert(message, "error", friendlyError(error));
    } finally {
      button.disabled = false;
    }
  });
}
