// Organisation dashboard: see your teachers and learners, invite teachers.

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

const teachersQuery = (orgId) =>
  supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("organisation_id", orgId)
    .eq("role", "teacher")
    .order("created_at", { ascending: false });

const studentsQuery = (orgId) =>
  supabase
    .from("profiles")
    .select("id, full_name, email, teacher_id, created_at")
    .eq("organisation_id", orgId)
    .eq("role", "student")
    .order("created_at", { ascending: false });

// ----- Dashboard -------------------------------------------------------------
async function overview({ profile, el }) {
  const orgId = profile.organisation_id;

  const [teachers, students, invites] = await Promise.all([
    teachersQuery(orgId),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .eq("role", "student"),
    supabase
      .from("invites")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .eq("status", "pending"),
  ]);
  check(teachers, students, invites);

  const teacherCount = teachers.data.length;
  const studentCount = students.count ?? 0;
  const average = teacherCount ? String(Math.round((studentCount / teacherCount) * 10) / 10) : "0";

  el.innerHTML = `
    ${pageHeader(`Welcome, ${firstName(profile.full_name)}`, profile.organisation?.name ?? "")}

    <div class="stat-grid">
      ${statCard("Teachers", teacherCount)}
      ${statCard("Students", studentCount)}
      ${statCard("Pending invitations", invites.count ?? 0)}
      ${statCard("Students per teacher", average)}
    </div>

    <section class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Your teachers</h3>
        <a href="#/teachers" class="btn-text">View all</a>
      </div>
      ${
        teacherCount
          ? dataTable(
              ["Name", "Email", "Joined"],
              teachers.data.slice(0, 5).map((t) => [
                esc(t.full_name),
                esc(t.email),
                esc(formatDate(t.created_at)),
              ]),
            )
          : `${emptyState("No teachers yet", "Invite your first teacher to get started.")}
             <div><a href="#/teachers" class="btn-primary">Invite a teacher</a></div>`
      }
    </section>`;
}

// ----- Teachers --------------------------------------------------------------
async function teachersView({ profile, el }) {
  el.innerHTML = `
    ${pageHeader("Teachers", "Invite teachers and see who is on your team.")}

    <section class="panel">
      <h3 class="panel-title">Invite a teacher</h3>
      ${inviteForm({ label: "Teacher's email address", button: "Invite teacher" })}
      <p class="form-hint">
        When they sign up with this email address they join your organisation
        as a teacher automatically.
      </p>
    </section>

    <section class="panel">
      <h3 class="panel-title">Your teachers</h3>
      <div data-teachers></div>
    </section>

    <section class="panel">
      <h3 class="panel-title">Pending invitations</h3>
      <div data-invites></div>
    </section>`;

  async function refresh() {
    const [teachers, students, invites] = await Promise.all([
      teachersQuery(profile.organisation_id),
      supabase
        .from("profiles")
        .select("teacher_id")
        .eq("organisation_id", profile.organisation_id)
        .eq("role", "student"),
      listPendingInvites("teacher"),
    ]);
    check(teachers, students);

    const perTeacher = {};
    for (const s of students.data) perTeacher[s.teacher_id] = (perTeacher[s.teacher_id] ?? 0) + 1;

    el.querySelector("[data-teachers]").innerHTML = teachers.data.length
      ? dataTable(
          ["Name", "Email", "Students", "Joined"],
          teachers.data.map((t) => [
            esc(t.full_name),
            esc(t.email),
            esc(perTeacher[t.id] ?? 0),
            esc(formatDate(t.created_at)),
          ]),
        )
      : emptyState("No teachers yet", "Invitations you send appear below until they sign up.");

    el.querySelector("[data-invites]").innerHTML = invitesTable(invites);
  }

  wireInvites({ root: el, role: "teacher", profile, refresh });
  await refresh();
}

// ----- Students (read only) ---------------------------------------------------
async function studentsView({ profile, el }) {
  const [students, teachers] = await Promise.all([
    studentsQuery(profile.organisation_id),
    teachersQuery(profile.organisation_id),
  ]);
  check(students, teachers);

  const teacherName = Object.fromEntries(teachers.data.map((t) => [t.id, t.full_name]));

  el.innerHTML = `
    ${pageHeader("Students", "Everyone learning with your teachers.")}
    <section class="panel">
      ${
        students.data.length
          ? dataTable(
              ["Name", "Email", "Teacher", "Joined"],
              students.data.map((s) => [
                esc(s.full_name),
                esc(s.email),
                esc(teacherName[s.teacher_id] ?? "Unassigned"),
                esc(formatDate(s.created_at)),
              ]),
            )
          : emptyState("No students yet", "Students appear here once your teachers add them.")
      }
    </section>`;
}

mountDashboard({
  role: "org_admin",
  nav: [
    { id: "overview", label: "Dashboard", icon: "dashboard" },
    { id: "teachers", label: "Teachers", icon: "users" },
    { id: "students", label: "Students", icon: "book" },
    { id: "profile", label: "Profile", icon: "user" },
  ],
  views: { overview, teachers: teachersView, students: studentsView, profile: profileView },
});
