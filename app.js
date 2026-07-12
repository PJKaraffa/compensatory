let currentUser = null;
let currentProfile = null;
let students = [];
let serviceEntries = [];

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  attachEvents();

  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "login.html";
    return;
  }

  currentUser = data.session.user;

 const { data: profile, error } = await supabaseClient
  .from("profiles")
  .select("id, full_name, role")
  .eq("id", currentUser.id)
  .maybeSingle();

if (error) {
  console.error("Profile error:", error);

  alert(
    "Login worked, but the profile could not be loaded: " +
    error.message
  );

  return;
}

if (!profile) {
  alert(
    "Login worked, but no profile record exists for this user. " +
    "Add the user's UUID to the profiles table."
  );

  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
  return;
}
  currentProfile = profile;

  document.getElementById("welcomeMessage").textContent =
    `${profile.full_name || currentUser.email} • ${capitalize(profile.role)}`;

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
  document.getElementById("searchInput").addEventListener("input", renderStudents);
  document.getElementById("schoolFilter").addEventListener("change", renderStudents);

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      closeModal(button.dataset.close);
    });
  });
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

async function loadDashboard() {
  clearMessage(document.getElementById("appMessage"));

  const studentRequest = supabaseClient
    .from("students")
    .select("*")
    .order("student_name");

  const serviceRequest = supabaseClient
    .from("service_entries")
    .select(`
      id,
      student_id,
      provider_id,
      service_date,
      start_time,
      end_time,
      hours,
      notes,
      provider:profiles!service_entries_provider_id_fkey(full_name)
    `)
    .order("service_date", { ascending: false })
    .order("start_time", { ascending: false });

  const [
    { data: studentData, error: studentError },
    { data: serviceData, error: serviceError }
  ] = await Promise.all([studentRequest, serviceRequest]);

  if (studentError) {
    showMessage(
      document.getElementById("appMessage"),
      studentError.message,
      "error"
    );
    return;
  }

  if (serviceError) {
    showMessage(
      document.getElementById("appMessage"),
      serviceError.message,
      "error"
    );
    return;
  }

  students = studentData || [];
  serviceEntries = serviceData || [];

  buildSchoolFilter();
  renderStudents();
  renderSummary();
}

function renderStudents() {
  const studentList = document.getElementById("studentList");
  const searchText = document.getElementById("searchInput")
    .value
    .trim()
    .toLowerCase();

  const selectedSchool = document.getElementById("schoolFilter").value;

  const filteredStudents = students.filter(student => {
    const values = [
      student.student_number,
      student.student_name,
      student.school,
      student.grade
    ];

    const matchesSearch = values.some(value =>
      String(value || "").toLowerCase().includes(searchText)
    );

    const matchesSchool =
      !selectedSchool || student.school === selectedSchool;

    return matchesSearch && matchesSchool;
  });

  if (!filteredStudents.length) {
    studentList.innerHTML = `
      <article class="student-card">
        <div class="empty-row">No students found.</div>
      </article>
    `;
    return;
  }

  studentList.innerHTML = filteredStudents.map(student => {
    const allStudentEntries = serviceEntries.filter(
      entry => entry.student_id === student.id
    );

    const visibleEntries =
      currentProfile.role === "administrator"
        ? allStudentEntries
        : allStudentEntries.filter(
            entry => entry.provider_id === currentUser.id
          );

    const totalCompleted = sumHours(allStudentEntries);

    const providerCompleted = sumHours(
      allStudentEntries.filter(
        entry => entry.provider_id === currentUser.id
      )
    );

    const hoursLeft = Math.max(
      0,
      Number(student.comp_hours) - totalCompleted
    );

    const serviceRows = visibleEntries.length
      ? visibleEntries.map(entry => `
          <tr>
            <td>${escapeHtml(entry.provider?.full_name || "Provider")}</td>
            <td>${formatDate(entry.service_date)}</td>
            <td>${formatTime(entry.start_time)}</td>
            <td>${formatTime(entry.end_time)}</td>
            <td>${Number(entry.hours).toFixed(2)}</td>
            <td>${escapeHtml(entry.notes || "")}</td>
            <td>
              ${
                canDeleteEntry(entry)
                  ? `
                    <button
                      class="danger-button small-button"
                      onclick="deleteServiceEntry('${entry.id}')"
                    >
                      Delete
                    </button>
                  `
                  : ""
              }
            </td>
          </tr>
        `).join("")
      : `
          <tr>
            <td colspan="7" class="empty-row">
              No service sessions recorded.
            </td>
          </tr>
        `;

    const administratorButtons =
      currentProfile.role === "administrator"
        ? `
          <button
            class="secondary-button small-button"
            onclick="openEditStudentModal('${student.id}')"
          >
            Edit Student
          </button>

          <button
            class="danger-button small-button"
            onclick="deleteStudent('${student.id}')"
          >
            Delete Student
          </button>
        `
        : "";

    return `
      <article class="student-card">

        <div class="student-header">

          <div class="student-main">
            <h2>${escapeHtml(student.student_name)}</h2>

            <p>
              ID: ${escapeHtml(student.student_number)}
              • ${escapeHtml(student.school)}
              • Grade ${escapeHtml(student.grade)}
            </p>
          </div>

          <div>
            <span class="metric-label">Comp Hours</span>
            <span class="metric-value">
              ${Number(student.comp_hours).toFixed(2)}
            </span>
          </div>

          <div>
            <span class="metric-label">
              ${
                currentProfile.role === "administrator"
                  ? "Completed Hours"
                  : "My Hours"
              }
            </span>

            <span class="metric-value">
              ${
                currentProfile.role === "administrator"
                  ? totalCompleted.toFixed(2)
                  : providerCompleted.toFixed(2)
              }
            </span>
          </div>

          <div>
            <span class="metric-label">Comp Hours Left</span>
            <span class="metric-value remaining">
              ${hoursLeft.toFixed(2)}
            </span>
          </div>

          <div class="student-actions">
            <button
              class="small-button"
              onclick="openServiceModal('${student.id}')"
            >
              Add Service
            </button>

            ${administratorButtons}
          </div>

        </div>

        <div class="table-wrap">
          <table class="service-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Date</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Hours</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              ${serviceRows}
            </tbody>
          </table>
        </div>

      </article>
    `;
  }).join("");
}

function renderSummary() {
  const totalAssigned = students.reduce(
    (sum, student) => sum + Number(student.comp_hours || 0),
    0
  );

  const totalCompleted = sumHours(serviceEntries);

  const providerCompleted = sumHours(
    serviceEntries.filter(
      entry => entry.provider_id === currentUser.id
    )
  );

  document.getElementById("studentCount").textContent =
    students.length;

  document.getElementById("assignedHours").textContent =
    totalAssigned.toFixed(2);

  document.getElementById("completedHours").textContent =
    (
      currentProfile.role === "administrator"
        ? totalCompleted
        : providerCompleted
    ).toFixed(2);

  document.getElementById("remainingHours").textContent =
    Math.max(0, totalAssigned - totalCompleted).toFixed(2);
}

function buildSchoolFilter() {
  const schoolFilter = document.getElementById("schoolFilter");
  const currentValue = schoolFilter.value;

  const schoolNames = [
    ...new Set(
      students
        .map(student => student.school)
        .filter(Boolean)
    )
  ].sort();

  schoolFilter.innerHTML =
    `<option value="">All Schools</option>` +
    schoolNames.map(school => `
      <option value="${escapeHtml(school)}">
        ${escapeHtml(school)}
      </option>
    `).join("");

  schoolFilter.value = schoolNames.includes(currentValue)
    ? currentValue
    : "";
}

function openAddStudentModal() {
  document.getElementById("studentModalTitle").textContent =
    "Add Student";

  document.getElementById("studentRecordId").value = "";
  document.getElementById("studentNumber").value = "";
  document.getElementById("studentName").value = "";
  document.getElementById("studentSchool").value = "";
  document.getElementById("studentGrade").value = "";
  document.getElementById("compHours").value = "";

  clearMessage(document.getElementById("studentMessage"));
  openModal("studentModal");
}

function openEditStudentModal(studentId) {
  const student = students.find(item => item.id === studentId);

  if (!student) {
    return;
  }

  document.getElementById("studentModalTitle").textContent =
    "Edit Student";

  document.getElementById("studentRecordId").value =
    student.id;

  document.getElementById("studentNumber").value =
    student.student_number;

  document.getElementById("studentName").value =
    student.student_name;

  document.getElementById("studentSchool").value =
    student.school;

  document.getElementById("studentGrade").value =
    student.grade;

  document.getElementById("compHours").value =
    student.comp_hours;

  clearMessage(document.getElementById("studentMessage"));
  openModal("studentModal");
}

async function saveStudent() {
  const message = document.getElementById("studentMessage");

  clearMessage(message);

  if (currentProfile.role !== "administrator") {
    showMessage(
      message,
      "Only administrators can add or edit students.",
      "error"
    );
    return;
  }

  const studentRecordId =
    document.getElementById("studentRecordId").value;

  const studentData = {
    student_number:
      document.getElementById("studentNumber").value.trim(),

    student_name:
      document.getElementById("studentName").value.trim(),

    school:
      document.getElementById("studentSchool").value.trim(),

    grade:
      document.getElementById("studentGrade").value.trim(),

    comp_hours:
      Number(document.getElementById("compHours").value)
  };

  if (
    !studentData.student_number ||
    !studentData.student_name ||
    !studentData.school ||
    !studentData.grade ||
    Number.isNaN(studentData.comp_hours) ||
    studentData.comp_hours < 0
  ) {
    showMessage(
      message,
      "Complete every student field.",
      "error"
    );
    return;
  }

  setButtonBusy(
    "saveStudentButton",
    true,
    "Saving..."
  );

  let result;

  if (studentRecordId) {
    result = await supabaseClient
      .from("students")
      .update(studentData)
      .eq("id", studentRecordId);
  } else {
    studentData.created_by = currentUser.id;

    result = await supabaseClient
      .from("students")
      .insert(studentData);
  }

  setButtonBusy(
    "saveStudentButton",
    false,
    "Save Student"
  );

  if (result.error) {
    showMessage(message, result.error.message, "error");
    return;
  }

  closeModal("studentModal");
  await loadDashboard();
}

function openServiceModal(studentId) {
  const student = students.find(item => item.id === studentId);

  if (!student) {
    return;
  }

  document.getElementById("serviceStudentId").value =
    student.id;

  document.getElementById("serviceStudentName").textContent =
    `${student.student_name} • ${student.student_number}`;

  document.getElementById("serviceDate").value =
    new Date().toISOString().slice(0, 10);

  document.getElementById("startTime").value = "";
  document.getElementById("endTime").value = "";
  document.getElementById("serviceNotes").value = "";

  clearMessage(document.getElementById("serviceMessage"));
  openModal("serviceModal");
}

async function saveServiceSession() {
  const message = document.getElementById("serviceMessage");

  clearMessage(message);

  const studentId =
    document.getElementById("serviceStudentId").value;

  const serviceDate =
    document.getElementById("serviceDate").value;

  const startTime =
    document.getElementById("startTime").value;

  const endTime =
    document.getElementById("endTime").value;

  const notes =
    document.getElementById("serviceNotes").value.trim();

  if (!studentId || !serviceDate || !startTime || !endTime) {
    showMessage(
      message,
      "Enter the date, start time, and end time.",
      "error"
    );
    return;
  }

  const hours = calculateHours(startTime, endTime);

  if (hours <= 0) {
    showMessage(
      message,
      "End time must be after start time.",
      "error"
    );
    return;
  }

  const student = students.find(item => item.id === studentId);

  const completedHours = sumHours(
    serviceEntries.filter(
      entry => entry.student_id === studentId
    )
  );

  const hoursLeft =
    Number(student.comp_hours) - completedHours;

  if (hours > hoursLeft + 0.0001) {
    showMessage(
      message,
      `This session is ${hours.toFixed(2)} hours, but only ${Math.max(0, hoursLeft).toFixed(2)} hours remain.`,
      "error"
    );
    return;
  }

  setButtonBusy(
    "saveServiceButton",
    true,
    "Saving..."
  );

  const { error } = await supabaseClient
    .from("service_entries")
    .insert({
      student_id: studentId,
      provider_id: currentUser.id,
      service_date: serviceDate,
      start_time: startTime,
      end_time: endTime,
      hours,
      notes
    });

  setButtonBusy(
    "saveServiceButton",
    false,
    "Save Session"
  );

  if (error) {
    showMessage(message, error.message, "error");
    return;
  }

  closeModal("serviceModal");
  await loadDashboard();
}

async function deleteServiceEntry(entryId) {
  const entry = serviceEntries.find(
    item => item.id === entryId
  );

  if (!entry || !canDeleteEntry(entry)) {
    return;
  }

  const approved = confirm(
    "Delete this service session?"
  );

  if (!approved) {
    return;
  }

  const { error } = await supabaseClient
    .from("service_entries")
    .delete()
    .eq("id", entryId);

  if (error) {
    showMessage(
      document.getElementById("appMessage"),
      error.message,
      "error"
    );
    return;
  }

  await loadDashboard();
}

async function deleteStudent(studentId) {
  if (currentProfile.role !== "administrator") {
    return;
  }

  const student = students.find(
    item => item.id === studentId
  );

  if (!student) {
    return;
  }

  const approved = confirm(
    `Delete ${student.student_name} and all service sessions?`
  );

  if (!approved) {
    return;
  }

  const { error } = await supabaseClient
    .from("students")
    .delete()
    .eq("id", studentId);

  if (error) {
    showMessage(
      document.getElementById("appMessage"),
      error.message,
      "error"
    );
    return;
  }

  await loadDashboard();
}

function canDeleteEntry(entry) {
  return (
    currentProfile.role === "administrator" ||
    entry.provider_id === currentUser.id
  );
}

function calculateHours(startTime, endTime) {
  const [startHour, startMinute] =
    startTime.split(":").map(Number);

  const [endHour, endMinute] =
    endTime.split(":").map(Number);

  const startTotalMinutes =
    startHour * 60 + startMinute;

  const endTotalMinutes =
    endHour * 60 + endMinute;

  const difference =
    (endTotalMinutes - startTotalMinutes) / 60;

  return Math.round(difference * 100) / 100;
}

function sumHours(entries) {
  return entries.reduce(
    (sum, entry) => sum + Number(entry.hours || 0),
    0
  );
}

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const [year, month, day] = dateString.split("-");
  return `${month}-${day}-${year}`;
}

function formatTime(timeString) {
  if (!timeString) {
    return "";
  }

  const [hourText, minute] = timeString.split(":");

  let hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";

  hour = hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}

function openModal(modalId) {
  document.getElementById(modalId).classList.remove("hidden");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add("hidden");
}

function setButtonBusy(buttonId, busy, text) {
  const button = document.getElementById(buttonId);

  button.disabled = busy;
  button.textContent = text;
}

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
}

function clearMessage(element) {
  element.textContent = "";
  element.className = "message";
}

function capitalize(value) {
  const text = String(value || "");

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.openEditStudentModal = openEditStudentModal;
window.openServiceModal = openServiceModal;
window.deleteServiceEntry = deleteServiceEntry;
window.deleteStudent = deleteStudent;
