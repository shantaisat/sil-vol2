// Teacher dashboard: see your students and add new ones.

import { supabase } from "../lib/supabase.js";
import {
  check,
  dataTable,
  emptyState,
  esc,
  firstName,
  formatDate,
  pageHeader,
  statCard,
} from "../lib/ui.js";
import { mountDashboard } from "./shell.js";
import { profileView } from "./profile-view.js";
import { inviteForm, invitesTable, listPendingInvites, wireInvites } from "./invites.js";

const studentsQuery = (teacherId) =>
  supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("teacher_id", teacherId)
    .eq("role", "student")
    .order("created_at", { ascending: false });

const studentsTable = (students) =>
  dataTable(
    ["Name", "Email", "Joined"],
    students.map((s) => [esc(s.full_name), esc(s.email), esc(formatDate(s.created_at))]),
  );

// ----- Dashboard -------------------------------------------------------------
async function overview({ profile, el }) {
  const [students, invites] = await Promise.all([
    studentsQuery(profile.id),
    supabase
      .from("invites")
      .select("id", { count: "exact", head: true })
      .eq("invited_by", profile.id)
      .eq("status", "pending"),
  ]);
  check(students, invites);

  el.innerHTML = `
    ${pageHeader(`Welcome, ${firstName(profile.full_name)}`, profile.organisation?.name ?? "")}

    <div class="stat-grid">
      ${statCard("Students", students.data.length)}
      ${statCard("Pending invitations", invites.count ?? 0)}
    </div>

    <section class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Your students</h3>
        <a href="#/students" class="btn-text">View all</a>
      </div>
      ${
        students.data.length
          ? studentsTable(students.data.slice(0, 5))
          : `${emptyState("No students yet", "Add your first student to get started.")}
             <div><a href="#/students" class="btn-primary">Add a student</a></div>`
      }
    </section>`;
}

// ----- Students --------------------------------------------------------------
async function studentsView({ profile, el }) {
  el.innerHTML = `
    ${pageHeader("Students", "Add students and follow who is learning with you.")}

    <section class="panel">
      <h3 class="panel-title">Add a student</h3>
      ${inviteForm({ label: "Student's email address", button: "Add student" })}
      <p class="form-hint">
        When they sign up with this email address they are linked to you
        automatically.
      </p>
    </section>

    <section class="panel">
      <h3 class="panel-title">Your students</h3>
      <div data-students></div>
    </section>

    <section class="panel">
      <h3 class="panel-title">Pending invitations</h3>
      <div data-invites></div>
    </section>`;

  async function refresh() {
    const [students, invites] = await Promise.all([
      studentsQuery(profile.id),
      listPendingInvites("student"),
    ]);
    check(students);

    el.querySelector("[data-students]").innerHTML = students.data.length
      ? studentsTable(students.data)
      : emptyState("No students yet", "Invitations you send appear below until they sign up.");

    el.querySelector("[data-invites]").innerHTML = invitesTable(invites);
  }

  wireInvites({ root: el, role: "student", profile, refresh });
  await refresh();
}

mountDashboard({
  role: "teacher",
  nav: [
    { id: "overview", label: "Dashboard", icon: "dashboard" },
    { id: "students", label: "Students", icon: "users" },
    { id: "profile", label: "Profile", icon: "user" },
  ],
  views: { overview, students: studentsView, profile: profileView },
});
