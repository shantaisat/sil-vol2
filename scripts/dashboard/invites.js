// Inviting people. Used by the organisation (teachers) and teacher (students) dashboards.
//
// An invite reserves an email address for a role. It does not send an email:
// the person signs up with that address and the database gives them the role
// (see supabase/schema.sql). The success message tells you the link to share.

import { supabase } from "../lib/supabase.js";
import { absoluteUrl } from "../lib/auth.js";
import {
  check,
  dataTable,
  emptyState,
  esc,
  formatDate,
  friendlyError,
  hideAlert,
  showAlert,
} from "../lib/ui.js";

export async function listPendingInvites(role) {
  const result = await supabase
    .from("invites")
    .select("id, email, created_at")
    .eq("role", role)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  check(result);
  return result.data;
}

async function createInvite({ email, role, profile }) {
  const { error } = await supabase.from("invites").insert({
    email: email.trim().toLowerCase(),
    role,
    organisation_id: profile.organisation_id,
    invited_by: profile.id,
    teacher_id: role === "student" ? profile.id : null,
  });
  if (error) throw error;
}

export function invitesTable(invites) {
  if (!invites.length) return emptyState("No pending invitations");
  return dataTable(
    ["Email", "Invited", ""],
    invites.map((invite) => [
      esc(invite.email),
      esc(formatDate(invite.created_at)),
      `<button type="button" class="btn-text" data-revoke-invite="${esc(invite.id)}">Withdraw</button>`,
    ]),
  );
}

// HTML for the "invite by email" form.
export const inviteForm = ({ label, button }) => `
  <form class="inline-form" data-invite-form novalidate>
    <div class="form-group">
      <label class="form-label" for="invite-email">${esc(label)}</label>
      <input class="form-input" id="invite-email" name="email" type="email"
        placeholder="name@example.com" autocomplete="off" required />
    </div>
    <button type="submit" class="btn-primary">${esc(button)}</button>
  </form>
  <p class="hidden" data-invite-message role="alert"></p>`;

// Wires up the form and the "Withdraw" buttons inside `root`.
//   role      "teacher" | "student"
//   refresh   async () => void   re-draws the lists after a change
export function wireInvites({ root, role, profile, refresh }) {
  const form = root.querySelector("[data-invite-form]");
  const message = root.querySelector("[data-invite-message]");
  const submit = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAlert(message);

    const email = form.email.value.trim();
    if (!email || !form.checkValidity()) {
      return showAlert(message, "error", "Please enter a valid email address.");
    }

    submit.disabled = true;
    try {
      await createInvite({ email, role, profile });
      form.reset();
      await refresh();
      showAlert(
        message,
        "success",
        `Invitation saved. Ask ${email.toLowerCase()} to sign up at ${absoluteUrl("pages/signup.html")} using that email address.`,
      );
    } catch (error) {
      showAlert(message, "error", friendlyError(error));
    } finally {
      submit.disabled = false;
    }
  });

  // Buttons are re-created on every refresh, so listen on the container.
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-revoke-invite]");
    if (!button) return;

    hideAlert(message);
    button.disabled = true;
    try {
      const { error } = await supabase
        .from("invites")
        .delete()
        .eq("id", button.dataset.revokeInvite);
      if (error) throw error;
      await refresh();
    } catch (error) {
      button.disabled = false;
      showAlert(message, "error", friendlyError(error));
    }
  });
}
