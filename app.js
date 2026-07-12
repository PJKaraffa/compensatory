let currentUser = null;
let currentProfile = null;
let students = [];
let serviceSessions = [];

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  attachEvents();

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.replace("login.html");
    return;
  }

  currentUser = data.session.user;

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profileError) {
    showMessage(document.getElementById("appMessage"), `Profile error: ${profileError.message}`, "error");
    return;
  }

  if (!profile) {
    await supabaseClient.auth.signOut();
    window.location.replace("login.html");
    return;
  }

  currentProfile = profile;
  document.getElementById("welcomeMessage").textContent =
    `${profile.full_name || currentUser.email} • ${capitalize(profile.role)}`;
  document.getElementById("completedLabel").textContent =
    profile.role === "administrator" ? "Completed Hours" : "My Hours";

  if (profile.role === "administrator") {
    document.getElementById("addStudentButton").classList.remove("hidden");
  }

  await loadDashboard();
}

function attachEvents() {
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("refreshButton").addEventListener("click", loadDashboard);
  document.getElementById("addStudentButton").addEventListener("click", openAddStudentModal);
  document.getElementById("saveStudentButton").addEventListener("click", saveStudent);
  document.getElementById("saveServiceButton").addEventListener("click", saveServiceSession);
  document.getElementById("exportButton").addEventListener("click", exportCsv);
  document.getElementById("searchInput").addEventListener("input", renderStudents);
  document.getElementById("schoolFilter").addEventListener("change", renderStudents);

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });
}

async function logout() {
  const button = document.getElementById("logoutButton");
  button.disabled = true;
  button.textContent = "Logging out...";

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    button.disabled = false;
    button.textContent = "Logout";
    showMessage(document.getElementById("appMessage"), error.message, "error");
    return;
  }

  window.location.replace("login.html");
}

async function loadDashboard() {
  const appMessage = document.getElementById("appMessage");
  clearMessage(appMessage);

  const [studentResult, serviceResult] = await Promise.all([
    supabaseClient.from("students").select("*").eq("active", true).order("last_name").order("first_name"),
    supabaseClient.from("service_sessions").select(`
      id, student_id, provider_id, service_date, start_time, end_time,
      hours, notes, created_at,
      provider:profiles!service_sessions_provider_id_fkey(full_name)
    `).order("service_date", { ascending: false }).order("start_time", { ascending: false })
  ]);

  if (studentResult.error) {
    showMessage(appMessage, studentResult.error.message, "error");
    return;
  }

  if (serviceResult.error) {
    showMessage(appMessage, serviceResult.error.message, "error");
    return;
  }

  students = studentResult.data || [];
  serviceSessions = serviceResult.data || [];

  buildSchoolFilter();
  renderStudents();
  renderSummary();
}

function renderStudents() {
  const list = document.getElementById("studentList");
  const searchText = document.getElementById("searchInput").value.trim().toLowerCase();
  const selectedSchool = document.getElementById("schoolFilter").value;

  const filtered = students.filter(student => {
    const values = [
      student.student_id,
      student.first_name,
      student.last_name,
      `${student.last_name}, ${student.first_name}`,
      student.school,
      student.grade
    ];

    return values.some(value => String(value || "").toLowerCase().includes(searchText)) &&
      (!selectedSchool || student.school === selectedSchool);
  });

  list.innerHTML = filtered.length
    ? filtered.map(buildStudentCard).join("")
    : `<article class="student-card"><div class="empty-row">No students found.</div></article>`;
}

function buildStudentCard(student) {
  const allSessions = serviceSessions.filter(session => session.student_id === student.id);
  const visibleSessions = currentProfile.role === "administrator"
    ? allSessions
    : allSessions.filter(session => session.provider_id === currentUser.id);

  const totalCompleted = sumHours(allSessions);
  const providerCompleted = sumHours(allSessions.filter(session => session.provider_id === currentUser.id));
  const assigned = Number(student.comp_hours || 0);
  const remaining = Math.max(0, assigned - totalCompleted);

  const rows = visibleSessions.length
    ? visibleSessions.map(buildServiceRow).join("")
    : `<tr><td colspan="7" class="empty-row">No service sessions recorded.</td></tr>`;

  const adminButtons = currentProfile.role === "administrator"
    ? `<button class="secondary-button small-button" type="button" onclick="openEditStudentModal('${student.id}')">Edit Student</button>
       <button class="danger-button small-button" type="button" onclick="deactivateStudent('${student.id}')">Remove Student</button>`
    : "";

  return `
    <article class="student-card">
      <div class="student-header">
        <div class="student-main">
          <h2>${escapeHtml(student.last_name)}, ${escapeHtml(student.first_name)}</h2>
          <p>ID: ${escapeHtml(student.student_id)} • ${escapeHtml(student.school)} • Grade ${escapeHtml(student.grade)}</p>
        </div>
        <div><span class="metric-label">Comp Hours</span><span class="metric-value">${assigned.toFixed(2)}</span></div>
        <div><span class="metric-label">${currentProfile.role === "administrator" ? "Completed Hours" : "My Hours"}</span><span class="metric-value">${(currentProfile.role === "administrator" ? totalCompleted : providerCompleted).toFixed(2)}</span></div>
        <div><span class="metric-label">Comp Hours Left</span><span class="metric-value remaining">${remaining.toFixed(2)}</span></div>
        <div class="student-actions">
          <button class="primary-button small-button" type="button" onclick="openServiceModal('${student.id}')">Add Service</button>
          ${adminButtons}
        </div>
      </div>
      <div class="table-wrap">
        <table class="service-table">
          <thead><tr><th>Provider</th><th>Date</th><th>Start Time</th><th>End Time</th><th>Hours</th><th>Notes</th><th>Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>`;
}

function buildServiceRow(session) {
  const deleteButton = currentProfile.role === "administrator" || session.provider_id === currentUser.id
    ? `<button class="danger-button small-button" type="button" onclick="deleteServiceSession('${session.id}')">Delete</button>`
    : "";

  return `<tr>
    <td>${escapeHtml(session.provider?.full_name || "Provider")}</td>
    <td>${formatDate(session.service_date)}</td>
    <td>${formatTime(session.start_time)}</td>
    <td>${formatTime(session.end_time)}</td>
    <td>${Number(session.hours || 0).toFixed(2)}</td>
    <td>${escapeHtml(session.notes || "")}</td>
    <td>${deleteButton}</td>
  </tr>`;
}

function renderSummary() {
  const totalAssigned = students.reduce((sum, student) => sum + Number(student.comp_hours || 0), 0);
  const totalCompleted = sumHours(serviceSessions);
  const providerCompleted = sumHours(serviceSessions.filter(session => session.provider_id === currentUser.id));

  document.getElementById("studentCount").textContent = students.length;
  document.getElementById("assignedHours").textContent = totalAssigned.toFixed(2);
  document.getElementById("completedHours").textContent =
    (currentProfile.role === "administrator" ? totalCompleted : providerCompleted).toFixed(2);
  document.getElementById("remainingHours").textContent = Math.max(0, totalAssigned - totalCompleted).toFixed(2);
}

function buildSchoolFilter() {
  const filter = document.getElementById("schoolFilter");
  const oldValue = filter.value;
  const schools = [...new Set(students.map(student => student.school).filter(Boolean))].sort();

  filter.innerHTML = `<option value="">All Schools</option>` +
    schools.map(school => `<option value="${escapeHtml(school)}">${escapeHtml(school)}</option>`).join("");

  filter.value = schools.includes(oldValue) ? oldValue : "";
}

function openAddStudentModal() {
  if (currentProfile.role !== "administrator") return;

  document.getElementById("studentModalTitle").textContent = "Add Student";
  ["studentRecordId", "studentId", "firstName", "lastName", "school", "grade", "compHours"].forEach(id => {
    document.getElementById(id).value = "";
  });
  clearMessage(document.getElementById("studentMessage"));
  openModal("studentModal");
}

function openEditStudentModal(studentUuid) {
  if (currentProfile.role !== "administrator") return;
  const student = students.find(item => item.id === studentUuid);
  if (!student) return;

  document.getElementById("studentModalTitle").textContent = "Edit Student";
  document.getElementById("studentRecordId").value = student.id;
  document.getElementById("studentId").value = student.student_id;
  document.getElementById("firstName").value = student.first_name;
  document.getElementById("lastName").value = student.last_name;
  document.getElementById("school").value = student.school;
  document.getElementById("grade").value = student.grade;
  document.getElementById("compHours").value = student.comp_hours;
  clearMessage(document.getElementById("studentMessage"));
  openModal("studentModal");
}

async function saveStudent() {
  const message = document.getElementById("studentMessage");
  clearMessage(message);

  if (currentProfile.role !== "administrator") {
    showMessage(message, "Only administrators can add or edit students.", "error");
    return;
  }

  const recordId = document.getElementById("studentRecordId").value;
  const payload = {
    student_id: document.getElementById("studentId").value.trim(),
    first_name: document.getElementById("firstName").value.trim(),
    last_name: document.getElementById("lastName").value.trim(),
    school: document.getElementById("school").value.trim(),
    grade: document.getElementById("grade").value.trim(),
    comp_hours: Number(document.getElementById("compHours").value),
    active: true
  };

  if (!payload.student_id || !payload.first_name || !payload.last_name || !payload.school || !payload.grade || Number.isNaN(payload.comp_hours) || payload.comp_hours < 0) {
    showMessage(message, "Complete every student field.", "error");
    return;
  }

  setButtonBusy("saveStudentButton", true, "Saving...");

  let result;
  if (recordId) {
    result = await supabaseClient.from("students").update(payload).eq("id", recordId);
  } else {
    payload.created_by = currentUser.id;
    result = await supabaseClient.from("students").insert(payload);
  }

  setButtonBusy("saveStudentButton", false, "Save Student");

  if (result.error) {
    showMessage(message, result.error.message, "error");
    return;
  }

  closeModal("studentModal");
  await loadDashboard();
}

function openServiceModal(studentUuid) {
  const student = students.find(item => item.id === studentUuid);
  if (!student) return;

  document.getElementById("serviceStudentId").value = student.id;
  document.getElementById("serviceStudentName").textContent = `${student.last_name}, ${student.first_name} • ${student.student_id}`;
  document.getElementById("serviceDate").value = getTodayDate();
  document.getElementById("startTime").value = "";
  document.getElementById("endTime").value = "";
  document.getElementById("serviceNotes").value = "";
  clearMessage(document.getElementById("serviceMessage"));
  openModal("serviceModal");
}

async function saveServiceSession() {
  const message = document.getElementById("serviceMessage");
  clearMessage(message);

  const studentUuid = document.getElementById("serviceStudentId").value;
  const serviceDate = document.getElementById("serviceDate").value;
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;
  const notes = document.getElementById("serviceNotes").value.trim();

  if (!studentUuid || !serviceDate || !startTime || !endTime) {
    showMessage(message, "Enter the date, start time, and end time.", "error");
    return;
  }

  const hours = calculateHours(startTime, endTime);
  if (hours <= 0) {
    showMessage(message, "End time must be after start time.", "error");
    return;
  }

  const student = students.find(item => item.id === studentUuid);
  const completed = sumHours(serviceSessions.filter(session => session.student_id === studentUuid));
  const remaining = Number(student.comp_hours || 0) - completed;

  if (hours > remaining + 0.0001) {
    showMessage(message, `This session is ${hours.toFixed(2)} hours, but only ${Math.max(0, remaining).toFixed(2)} hours remain.`, "error");
    return;
  }

  setButtonBusy("saveServiceButton", true, "Saving...");
  const { error } = await supabaseClient.from("service_sessions").insert({
    student_id: studentUuid,
    provider_id: currentUser.id,
    service_date: serviceDate,
    start_time: startTime,
    end_time: endTime,
    hours,
    notes: notes || null
  });
  setButtonBusy("saveServiceButton", false, "Save Session");

  if (error) {
    showMessage(message, error.message, "error");
    return;
  }

  closeModal("serviceModal");
  await loadDashboard();
}

async function deleteServiceSession(sessionUuid) {
  const session = serviceSessions.find(item => item.id === sessionUuid);
  if (!session) return;

  if (!(currentProfile.role === "administrator" || session.provider_id === currentUser.id)) {
    alert("You do not have permission to delete this session.");
    return;
  }

  if (!confirm("Delete this service session?")) return;

  const { error } = await supabaseClient.from("service_sessions").delete().eq("id", sessionUuid);
  if (error) {
    showMessage(document.getElementById("appMessage"), error.message, "error");
    return;
  }

  await loadDashboard();
}

async function deactivateStudent(studentUuid) {
  if (currentProfile.role !== "administrator") return;
  const student = students.find(item => item.id === studentUuid);
  if (!student) return;

  if (!confirm(`Remove ${student.last_name}, ${student.first_name} from the active list?`)) return;

  const { error } = await supabaseClient.from("students").update({ active: false }).eq("id", studentUuid);
  if (error) {
    showMessage(document.getElementById("appMessage"), error.message, "error");
    return;
  }

  await loadDashboard();
}

function exportCsv() {
  const rows = [["Student ID","Student Name","School","Grade","Comp Hours","Completed Hours","Hours Left","Provider","Service Date","Start Time","End Time","Session Hours","Notes"]];

  students.forEach(student => {
    const allSessions = serviceSessions.filter(session => session.student_id === student.id);
    const visibleSessions = currentProfile.role === "administrator" ? allSessions : allSessions.filter(session => session.provider_id === currentUser.id);
    const totalCompleted = sumHours(allSessions);
    const hoursLeft = Math.max(0, Number(student.comp_hours) - totalCompleted);

    if (!visibleSessions.length) {
      rows.push([student.student_id,`${student.last_name}, ${student.first_name}`,student.school,student.grade,Number(student.comp_hours).toFixed(2),totalCompleted.toFixed(2),hoursLeft.toFixed(2),"","","","","",""]);
      return;
    }

    visibleSessions.forEach(session => rows.push([
      student.student_id,`${student.last_name}, ${student.first_name}`,student.school,student.grade,
      Number(student.comp_hours).toFixed(2),totalCompleted.toFixed(2),hoursLeft.toFixed(2),
      session.provider?.full_name || "Provider",formatDate(session.service_date),formatTime(session.start_time),
      formatTime(session.end_time),Number(session.hours).toFixed(2),session.notes || ""
    ]));
  });

  const csv = rows.map(row => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sped_compensatory_services_${getTodayDate()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function calculateHours(startTime, endTime) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.round((((eh * 60 + em) - (sh * 60 + sm)) / 60) * 100) / 100;
}

function sumHours(entries) {
  return entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${month}-${day}-${year}`;
}

function formatTime(timeString) {
  if (!timeString) return "";
  const [hourText, minute] = timeString.split(":");
  let hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }
function setButtonBusy(id, busy, text) { const b = document.getElementById(id); b.disabled = busy; b.textContent = text; }
function showMessage(el, text, type) { if (!el) return; el.textContent = text; el.className = `message ${type}`; }
function clearMessage(el) { if (!el) return; el.textContent = ""; el.className = "message"; }
function capitalize(value) { const t = String(value || ""); return t.charAt(0).toUpperCase() + t.slice(1); }
function csvEscape(value) { const t = String(value ?? ""); return /[",\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

window.openEditStudentModal = openEditStudentModal;
window.openServiceModal = openServiceModal;
window.deleteServiceSession = deleteServiceSession;
window.deactivateStudent = deactivateStudent;
