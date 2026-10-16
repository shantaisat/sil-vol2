// Student dashboard: your own details, plus placeholders for the learning
// features that come later (courses, sessions, progress).

import {
  emptyState,
  esc,
  firstName,
  formatDate,
  pageHeader,
  statCard,
} from "../lib/ui.js";
import { mountDashboard } from "./shell.js";
import { profileView } from "./profile-view.js";

const detail = (label, value) => `
  <div>
    <div class="detail-label">${esc(label)}</div>
    <div class="detail-value">${esc(value)}</div>
  </div>`;

// Course cards are placeholders until courses are built.
const PLACEHOLDER_COURSES = [
  "Digital skills basics",
  "Getting started with AI",
  "Online safety essentials",
];

// ----- Dashboard -------------------------------------------------------------
async function overview({ profile, el }) {
  const teacher = profile.teacher;

  el.innerHTML = `
    ${pageHeader(`Welcome back, ${firstName(profile.full_name)}`, "Here is where your learning journey starts.")}

    <div class="stat-grid">
      ${statCard("Courses in progress", 0)}
      ${statCard("Upcoming sessions", 0)}
      ${statCard("Learning progress", "0%")}
      ${statCard("Badges earned", 0)}
    </div>

    <section class="panel">
      <h3 class="panel-title">Your details</h3>
      <div class="detail-list">
        ${detail("Name", profile.full_name)}
        ${detail("Email", profile.email)}
        ${detail("Your teacher", teacher ? teacher.full_name : "Not assigned yet")}
        ${detail("Organisation", profile.organisation?.name ?? "Independent learner")}
        ${detail("Member since", formatDate(profile.created_at))}
      </div>
      ${
        teacher
          ? ""
          : '<p class="alert-info">You are not linked to a teacher yet. If a teacher or organisation invited you, sign up with the email address they used.</p>'
      }
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Upcoming sessions</h3>
      </div>
      ${emptyState("No sessions scheduled yet", "Sessions with your teacher will appear here.")}
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Recommended for you</h3>
        <span class="badge-muted">Coming soon</span>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        ${PLACEHOLDER_COURSES.map(
          (title) => `
          <div class="programme-card">
            <div class="programme-img">img</div>
            <div class="programme-title">${esc(title)}</div>
            <div class="programme-text">Course content is on its way.</div>
          </div>`,
        ).join("")}
      </div>
    </section>`;
}

// Placeholder pages for features that are still to be built.
const placeholder = (title, text) => async ({ el }) => {
  el.innerHTML = `
    ${pageHeader(title)}
    <section class="panel">${emptyState(`${title} are coming soon`, text)}</section>`;
};

mountDashboard({
  role: "student",
  nav: [
    { id: "overview", label: "Dashboard", icon: "dashboard" },
    { id: "learning", label: "My Learning", icon: "book" },
    { id: "sessions", label: "Sessions", icon: "calendar" },
    { id: "profile", label: "Profile", icon: "user" },
  ],
  views: {
    overview,
    learning: placeholder("My Learning", "Your courses and progress will live here."),
    sessions: placeholder("Sessions", "Your scheduled sessions will live here."),
    profile: profileView,
  },
});
