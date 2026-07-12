// ======================================================
// SPED COMPENSATORY SERVICES
// COMPLETE APPLICATION JAVASCRIPT
// ======================================================

let currentUser = null;
let currentProfile = null;

let students = [];
let serviceSessions = [];


// ======================================================
// START APPLICATION
// ======================================================

document.addEventListener("DOMContentLoaded", initializeApp);


async function initializeApp() {
  attachEvents();

  const { data, error } =
    await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    redirectToLogin();
    return;
  }

  if (!data.session) {
    redirectToLogin();
    return;
  }

  currentUser = data.session.user;

  const profileLoaded =
    await loadCurrentProfile();

  if (!profileLoaded) {
    return;
  }

  displayCurrentUser();

  await loadDashboard();
}


// ======================================================
// EVENT LISTENERS
// ======================================================

function attachEvents() {
  document
    .getElementById("logoutButton")
    .addEventListener("click", logout);

  document
    .getElementById("refreshButton")
    .addEventListener("click", loadDashboard);

  document
    .getElementById("addStudentButton")
    .addEventListener("click", openAddStudentModal);

  document
    .getElementById("saveStudentButton")
    .addEventListener("click", saveStudent);

  document
    .getElementById("saveServiceButton")
    .addEventListener("click", saveServiceSession);

  document
    .getElementById("exportButton")
    .addEventListener("click", exportCsv);

  document
    .getElementById("searchInput")
    .addEventListener("input", renderStudents);

  document
    .getElementById("schoolFilter")
    .addEventListener("change", renderStudents);

  document
    .getElementById("studentList")
    .addEventListener("click", handleStudentButtonClick);

  document
    .querySelectorAll("[data-close]")
    .forEach(button => {
      button.addEventListener("click", () => {
        closeModal(button.dataset.close);
      });
    });
}


// ======================================================
// DYNAMIC STUDENT BUTTON HANDLER
// ======================================================

function handleStudentButtonClick(event) {
  const button =
    event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const action =
    button.dataset.action;

  const studentId =
    button.dataset.studentId;

  const sessionId =
    button.dataset.sessionId;

  switch (action) {
    case "add-service":
      openServiceModal(studentId);
      break;

    case "edit-student":
      openEditStudentModal(studentId);
      break;

    case "remove-student":
      deactivateStudent(studentId);
      break;

    case "delete-session":
      deleteServiceSession(sessionId);
      break;
  }
}


// ======================================================
// LOAD CURRENT USER PROFILE
// ======================================================

async function loadCurrentProfile() {
  const {
    data: profile,
    error
  } = await supabaseClient
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile error:", error);

    alert(
      "Login worked, but your profile could not be loaded.\n\n" +
      error.message
    );

    return false;
  }

  if (!profile) {
    alert(
      "Login worked, but no profile record exists for this account."
    );

    await supabaseClient.auth.signOut();

    redirectToLogin();

    return false;
  }

  currentProfile = profile;

  return true;
}


// ======================================================
// DISPLAY CURRENT USER
// ======================================================

function displayCurrentUser() {
  const welcomeMessage =
    document.getElementById("welcomeMessage");

  const addStudentButton =
    document.getElementById("addStudentButton");

  const completedLabel =
    document.getElementById("completedLabel");

  welcomeMessage.textContent =
    `${currentProfile.full_name || currentUser.email} • ${capitalize(currentProfile.role)}`;

  completedLabel.textContent =
    currentProfile.role === "administrator"
      ? "Completed Hours"
      : "My Hours";

  if (currentProfile.role === "administrator") {
    addStudentButton.classList.remove("hidden");
  } else {
    addStudentButton.classList.add("hidden");
  }
}


// ======================================================
// LOGOUT
// ======================================================

async function logout() {
  const logoutButton =
    document.getElementById("logoutButton");

  logoutButton.disabled = true;
  logoutButton.textContent = "Logging out...";

  const { error } =
    await supabaseClient.auth.signOut();

  if (error) {
    console.error("Logout error:", error);

    logoutButton.disabled = false;
    logoutButton.textContent = "Logout";

    showMessage(
      document.getElementById("appMessage"),
      error.message,
      "error"
    );

    return;
  }

  window.location.replace("login.html");
}


function redirectToLogin() {
  window.location.replace("login.html");
}


// ======================================================
// LOAD DASHBOARD
// ======================================================

async function loadDashboard() {
  const appMessage =
    document.getElementById("appMessage");

  clearMessage(appMessage);

  const studentRequest =
    supabaseClient
      .from("students")
      .select("*")
      .eq("active", true)
      .order("last_name", {
        ascending: true
      })
      .order("first_name", {
        ascending: true
      });

  const serviceRequest =
    supabaseClient
      .from("service_sessions")
      .select(`
        id,
        student_id,
        provider_id,
        service_date,
        start_time,
        end_time,
        hours,
        notes,
        created_at,
        provider:profiles!service_sessions_provider_id_fkey
        (
          full_name
        )
      `)
      .order("service_date", {
        ascending: false
      })
      .order("start_time", {
        ascending: false
      });

  const [
    studentResult,
    serviceResult
  ] = await Promise.all([
    studentRequest,
    serviceRequest
  ]);

  if (studentResult.error) {
    console.error(
      "Student load error:",
      studentResult.error
    );

    showMessage(
      appMessage,
      studentResult.error.message,
      "error"
    );

    return;
  }

  if (serviceResult.error) {
    console.error(
      "Service load error:",
      serviceResult.error
    );

    showMessage(
      appMessage,
      serviceResult.error.message,
      "error"
    );

    return;
  }

  students =
    studentResult.data || [];

  serviceSessions =
    serviceResult.data || [];

  buildSchoolFilter();
  renderStudents();
  renderSummary();
}


// ======================================================
// RENDER STUDENTS
// ======================================================

function renderStudents() {
  const studentList =
    document.getElementById("studentList");

  const searchText =
    document
      .getElementById("searchInput")
      .value
      .trim()
      .toLowerCase();

  const selectedSchool =
    document
      .getElementById("schoolFilter")
      .value;

  const filteredStudents =
    students.filter(student => {
      const fullName =
        `${student.last_name}, ${student.first_name}`
          .toLowerCase();

      const values = [
        student.student_id,
        student.first_name,
        student.last_name,
        fullName,
        student.school,
        student.grade
      ];

      const matchesSearch =
        values.some(value =>
          String(value || "")
            .toLowerCase()
            .includes(searchText)
        );

      const matchesSchool =
        !selectedSchool ||
        student.school === selectedSchool;

      return matchesSearch && matchesSchool;
    });

  if (!filteredStudents.length) {
    studentList.innerHTML = `
      <article class="student-card">
        <div class="empty-row">
          No students found.
        </div>
      </article>
    `;

    return;
  }

  studentList.innerHTML =
    filteredStudents
      .map(student =>
        buildStudentCard(student)
      )
      .join("");
}


// ======================================================
// BUILD STUDENT CARD
// ======================================================

function buildStudentCard(student) {
  const allStudentSessions =
    serviceSessions.filter(
      session =>
        session.student_id === student.id
    );

  const visibleSessions =
    currentProfile.role === "administrator"
      ? allStudentSessions
      : allStudentSessions.filter(
          session =>
            session.provider_id === currentUser.id
        );

  const totalCompleted =
    sumHours(allStudentSessions);

  const providerCompleted =
    sumHours(
      allStudentSessions.filter(
        session =>
          session.provider_id === currentUser.id
      )
    );

  const assignedHours =
    Number(student.comp_hours || 0);

  const hoursLeft =
    Math.max(
      0,
      assignedHours - totalCompleted
    );

  const serviceRows =
    visibleSessions.length
      ? visibleSessions
          .map(session =>
            buildServiceRow(session)
          )
          .join("")
      : `
          <tr>
            <td
              colspan="7"
              class="empty-row"
            >
              No service sessions recorded.
            </td>
          </tr>
        `;

  const adminButtons =
    currentProfile.role === "administrator"
      ? `
          <button
            class="secondary-button small-button"
            type="button"
            data-action="edit-student"
            data-student-id="${student.id}"
          >
            Edit Student
          </button>

          <button
            class="danger-button small-button"
            type="button"
            data-action="remove-student"
            data-student-id="${student.id}"
          >
            Remove Student
          </button>
        `
      : "";

  const completedLabel =
    currentProfile.role === "administrator"
      ? "Completed Hours"
      : "My Hours";

  const completedValue =
    currentProfile.role === "administrator"
      ? totalCompleted
      : providerCompleted;

  return `
    <article class="student-card">

      <div class="student-header">

        <div class="student-main">
          <h2>
            ${escapeHtml(student.last_name)},
            ${escapeHtml(student.first_name)}
          </h2>

          <p>
            ID:
            ${escapeHtml(student.student_id)}
            •
            ${escapeHtml(student.school)}
            • Grade
            ${escapeHtml(student.grade)}
          </p>
        </div>

        <div>
          <span class="metric-label">
            Comp Hours
          </span>

          <span class="metric-value">
            ${assignedHours.toFixed(2)}
          </span>
        </div>

        <div>
          <span class="metric-label">
            ${completedLabel}
          </span>

          <span class="metric-value">
            ${completedValue.toFixed(2)}
          </span>
        </div>

        <div>
          <span class="metric-label">
            Comp Hours Left
          </span>

          <span class="metric-value remaining">
            ${hoursLeft.toFixed(2)}
          </span>
        </div>

        <div class="student-actions">

          <button
            class="primary-button small-button"
            type="button"
            data-action="add-service"
            data-student-id="${student.id}"
          >
            Add Service
          </button>

          ${adminButtons}

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
}


// ======================================================
// BUILD SERVICE ROW
// ======================================================

function buildServiceRow(session) {
  const providerName =
    session.provider?.full_name ||
    "Provider";

  const canDelete =
    currentProfile.role === "administrator" ||
    session.provider_id === currentUser.id;

  const deleteButton =
    canDelete
      ? `
          <button
            class="danger-button small-button"
            type="button"
            data-action="delete-session"
            data-session-id="${session.id}"
          >
            Delete
          </button>
        `
      : "";

  return `
    <tr>
      <td>
        ${escapeHtml(providerName)}
      </td>

      <td>
        ${formatDate(session.service_date)}
      </td>

      <td>
        ${formatTime(session.start_time)}
      </td>

      <td>
        ${formatTime(session.end_time)}
      </td>

      <td>
        ${Number(session.hours || 0).toFixed(2)}
      </td>

      <td>
        ${escapeHtml(session.notes || "")}
      </td>

      <td>
        ${deleteButton}
      </td>
    </tr>
  `;
}


// ======================================================
// DASHBOARD SUMMARY
// ======================================================

function renderSummary() {
  const totalAssigned =
    students.reduce(
      (sum, student) =>
        sum +
        Number(student.comp_hours || 0),
      0
    );

  const totalCompleted =
    sumHours(serviceSessions);

  const providerCompleted =
    sumHours(
      serviceSessions.filter(
        session =>
          session.provider_id === currentUser.id
      )
    );

  const displayedCompleted =
    currentProfile.role === "administrator"
      ? totalCompleted
      : providerCompleted;

  const totalRemaining =
    Math.max(
      0,
      totalAssigned - totalCompleted
    );

  document
    .getElementById("studentCount")
    .textContent =
      students.length;

  document
    .getElementById("assignedHours")
    .textContent =
      totalAssigned.toFixed(2);

  document
    .getElementById("completedHours")
    .textContent =
      displayedCompleted.toFixed(2);

  document
    .getElementById("remainingHours")
    .textContent =
      totalRemaining.toFixed(2);
}


// ======================================================
// SCHOOL FILTER
// ======================================================

function buildSchoolFilter() {
  const schoolFilter =
    document.getElementById("schoolFilter");

  const currentValue =
    schoolFilter.value;

  const schools = [
    ...new Set(
      students
        .map(student => student.school)
        .filter(Boolean)
    )
  ].sort();

  schoolFilter.innerHTML =
    `<option value="">All Schools</option>` +
    schools
      .map(school => `
        <option value="${escapeHtml(school)}">
          ${escapeHtml(school)}
        </option>
      `)
      .join("");

  if (schools.includes(currentValue)) {
    schoolFilter.value = currentValue;
  }
}


// ======================================================
// ADD STUDENT MODAL
// ======================================================

function openAddStudentModal() {
  if (
    currentProfile.role !==
    "administrator"
  ) {
    return;
  }

  document
    .getElementById("studentModalTitle")
    .textContent =
      "Add Student";

  document
    .getElementById("studentRecordId")
    .value = "";

  document
    .getElementById("studentId")
    .value = "";

  document
    .getElementById("firstName")
    .value = "";

  document
    .getElementById("lastName")
    .value = "";

  document
    .getElementById("school")
    .value = "";

  document
    .getElementById("grade")
    .value = "";

  document
    .getElementById("compHours")
    .value = "";

  clearMessage(
    document.getElementById("studentMessage")
  );

  openModal("studentModal");
}


// ======================================================
// EDIT STUDENT MODAL
// ======================================================

function openEditStudentModal(studentId) {
  if (
    currentProfile.role !==
    "administrator"
  ) {
    return;
  }

  const student =
  students.find(
    item => String(item.id) === String(studentId)
  );

  if (!student) {
    alert("Student record not found.");
    return;
  }

  document
    .getElementById("studentModalTitle")
    .textContent =
      "Edit Student";

  document
    .getElementById("studentRecordId")
    .value =
      student.id;

  document
    .getElementById("studentId")
    .value =
      student.student_id;

  document
    .getElementById("firstName")
    .value =
      student.first_name;

  document
    .getElementById("lastName")
    .value =
      student.last_name;

  document
    .getElementById("school")
    .value =
      student.school;

  document
    .getElementById("grade")
    .value =
      student.grade;

  document
    .getElementById("compHours")
    .value =
      student.comp_hours;

  clearMessage(
    document.getElementById("studentMessage")
  );

  openModal("studentModal");
}


// ======================================================
// SAVE STUDENT
// ======================================================

async function saveStudent() {
  const studentMessage =
    document.getElementById("studentMessage");

  clearMessage(studentMessage);

  if (
    currentProfile.role !==
    "administrator"
  ) {
    showMessage(
      studentMessage,
      "Only administrators can add or edit students.",
      "error"
    );

    return;
  }

  const recordId =
    document
      .getElementById("studentRecordId")
      .value;

  const studentData = {
    student_id:
      document
        .getElementById("studentId")
        .value
        .trim(),

    first_name:
      document
        .getElementById("firstName")
        .value
        .trim(),

    last_name:
      document
        .getElementById("lastName")
        .value
        .trim(),

    school:
      document
        .getElementById("school")
        .value
        .trim(),

    grade:
      document
        .getElementById("grade")
        .value
        .trim(),

    comp_hours:
      Number(
        document
          .getElementById("compHours")
          .value
      ),

    active:
      true
  };

  if (
    !studentData.student_id ||
    !studentData.first_name ||
    !studentData.last_name ||
    !studentData.school ||
    !studentData.grade ||
    Number.isNaN(studentData.comp_hours) ||
    studentData.comp_hours < 0
  ) {
    showMessage(
      studentMessage,
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

  if (recordId) {
    result =
      await supabaseClient
        .from("students")
        .update(studentData)
        .eq("id", recordId);
  } else {
    studentData.created_by =
      currentUser.id;

    result =
      await supabaseClient
        .from("students")
        .insert(studentData);
  }

  setButtonBusy(
    "saveStudentButton",
    false,
    "Save Student"
  );

  if (result.error) {
    console.error(
      "Save student error:",
      result.error
    );

    showMessage(
      studentMessage,
      result.error.message,
      "error"
    );

    return;
  }

  closeModal("studentModal");

  await loadDashboard();
}


// ======================================================
// OPEN SERVICE MODAL
// ======================================================

function openServiceModal(studentId) {
  const student = students.find(
    item => String(item.id) === String(studentId)
  );

  if (!student) {
    console.error("Student not found:", studentId, students);
    alert("Student record not found.");
    return;
  }

  document
    .getElementById("serviceStudentId")
    .value = student.id;

  document
    .getElementById("serviceStudentName")
    .textContent =
      `${student.last_name}, ${student.first_name} • ${student.student_id}`;

  document
    .getElementById("serviceDate")
    .value = getTodayDate();

  document
    .getElementById("startTime")
    .value = "";

  document
    .getElementById("endTime")
    .value = "";

  document
    .getElementById("serviceNotes")
    .value = "";

  clearMessage(
    document.getElementById("serviceMessage")
  );

  openModal("serviceModal");
}

// ======================================================
// SAVE SERVICE SESSION
// ======================================================

async function saveServiceSession() {
  const serviceMessage =
    document.getElementById("serviceMessage");

  clearMessage(serviceMessage);

  const studentId =
    document
      .getElementById("serviceStudentId")
      .value;

  const serviceDate =
    document
      .getElementById("serviceDate")
      .value;

  const startTime =
    document
      .getElementById("startTime")
      .value;

  const endTime =
    document
      .getElementById("endTime")
      .value;

  const notes =
    document
      .getElementById("serviceNotes")
      .value
      .trim();

  if (
    !studentId ||
    !serviceDate ||
    !startTime ||
    !endTime
  ) {
    showMessage(
      serviceMessage,
      "Enter the date, start time, and end time.",
      "error"
    );

    return;
  }

  const calculatedHours =
    calculateHours(
      startTime,
      endTime
    );

  if (calculatedHours <= 0) {
    showMessage(
      serviceMessage,
      "End time must be after start time.",
      "error"
    );

    return;
  }

  const student =
    students.find(
      item => item.id === studentId
    );

  if (!student) {
    showMessage(
      serviceMessage,
      "Student record not found.",
      "error"
    );

    return;
  }

  const completedHours =
    sumHours(
      serviceSessions.filter(
        session =>
          session.student_id === studentId
      )
    );

  const hoursLeft =
    Number(student.comp_hours || 0) -
    completedHours;

  if (
    calculatedHours >
    hoursLeft + 0.0001
  ) {
    showMessage(
      serviceMessage,
      `This session is ${calculatedHours.toFixed(2)} hours, but only ${Math.max(0, hoursLeft).toFixed(2)} hours remain.`,
      "error"
    );

    return;
  }

  setButtonBusy(
    "saveServiceButton",
    true,
    "Saving..."
  );

  const { error } =
    await supabaseClient
      .from("service_sessions")
      .insert({
        student_id:
          studentId,

        provider_id:
          currentUser.id,

        service_date:
          serviceDate,

        start_time:
          startTime,

        end_time:
          endTime,

        hours:
          calculatedHours,

        notes:
          notes || null
      });

  setButtonBusy(
    "saveServiceButton",
    false,
    "Save Session"
  );

  if (error) {
    console.error(
      "Save service error:",
      error
    );

    showMessage(
      serviceMessage,
      error.message,
      "error"
    );

    return;
  }

  closeModal("serviceModal");

  await loadDashboard();
}


// ======================================================
// DELETE SERVICE SESSION
// ======================================================

async function deleteServiceSession(sessionId) {
  const session =
  serviceSessions.find(
    item => String(item.id) === String(sessionId)
  );

  if (!session) {
    alert("Service session not found.");
    return;
  }

  const canDelete =
    currentProfile.role === "administrator" ||
    session.provider_id === currentUser.id;

  if (!canDelete) {
    alert(
      "You do not have permission to delete this session."
    );

    return;
  }

  const confirmed =
    confirm(
      "Delete this service session?"
    );

  if (!confirmed) {
    return;
  }

  const { error } =
    await supabaseClient
      .from("service_sessions")
      .delete()
      .eq("id", sessionId);

  if (error) {
    console.error(
      "Delete session error:",
      error
    );

    showMessage(
      document.getElementById("appMessage"),
      error.message,
      "error"
    );

    return;
  }

  await loadDashboard();
}


// ======================================================
// REMOVE / DEACTIVATE STUDENT
// ======================================================

async function deactivateStudent(studentId) {
  if (
    currentProfile.role !==
    "administrator"
  ) {
    return;
  }

  const student =
    students.find(
      item => item.id === studentId
    );

  if (!student) {
    alert("Student record not found.");
    return;
  }

  const confirmed =
    confirm(
      `Remove ${student.last_name}, ${student.first_name} from the active student list?`
    );

  if (!confirmed) {
    return;
  }

  const { error } =
    await supabaseClient
      .from("students")
      .update({
        active: false
      })
      .eq("id", studentId);

  if (error) {
    console.error(
      "Deactivate student error:",
      error
    );

    showMessage(
      document.getElementById("appMessage"),
      error.message,
      "error"
    );

    return;
  }

  await loadDashboard();
}


// ======================================================
// CSV EXPORT
// ======================================================

function exportCsv() {
  const rows = [
    [
      "Student ID",
      "Student Name",
      "School",
      "Grade",
      "Comp Hours",
      "Completed Hours",
      "Hours Left",
      "Provider",
      "Service Date",
      "Start Time",
      "End Time",
      "Session Hours",
      "Notes"
    ]
  ];

  students.forEach(student => {
    const allStudentSessions =
      serviceSessions.filter(
        session =>
          session.student_id === student.id
      );

    const visibleSessions =
      currentProfile.role === "administrator"
        ? allStudentSessions
        : allStudentSessions.filter(
            session =>
              session.provider_id === currentUser.id
          );

    const totalCompleted =
      sumHours(allStudentSessions);

    const hoursLeft =
      Math.max(
        0,
        Number(student.comp_hours || 0) -
        totalCompleted
      );

    if (!visibleSessions.length) {
      rows.push([
        student.student_id,
        `${student.last_name}, ${student.first_name}`,
        student.school,
        student.grade,
        Number(student.comp_hours || 0).toFixed(2),
        totalCompleted.toFixed(2),
        hoursLeft.toFixed(2),
        "",
        "",
        "",
        "",
        "",
        ""
      ]);

      return;
    }

    visibleSessions.forEach(session => {
      rows.push([
        student.student_id,
        `${student.last_name}, ${student.first_name}`,
        student.school,
        student.grade,
        Number(student.comp_hours || 0).toFixed(2),
        totalCompleted.toFixed(2),
        hoursLeft.toFixed(2),
        session.provider?.full_name || "Provider",
        formatDate(session.service_date),
        formatTime(session.start_time),
        formatTime(session.end_time),
        Number(session.hours || 0).toFixed(2),
        session.notes || ""
      ]);
    });
  });

  const csv =
    rows
      .map(row =>
        row
          .map(value => csvEscape(value))
          .join(",")
      )
      .join("\n");

  const blob =
    new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `sped_compensatory_services_${getTodayDate()}.csv`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}


// ======================================================
// CALCULATE HOURS
// ======================================================

function calculateHours(
  startTime,
  endTime
) {
  const [
    startHour,
    startMinute
  ] =
    startTime
      .split(":")
      .map(Number);

  const [
    endHour,
    endMinute
  ] =
    endTime
      .split(":")
      .map(Number);

  const startMinutes =
    startHour * 60 +
    startMinute;

  const endMinutes =
    endHour * 60 +
    endMinute;

  const difference =
    endMinutes -
    startMinutes;

  if (difference <= 0) {
    return 0;
  }

  return (
    Math.round(
      (difference / 60) * 100
    ) / 100
  );
}


// ======================================================
// SUM HOURS
// ======================================================

function sumHours(sessions) {
  return sessions.reduce(
    (sum, session) =>
      sum +
      Number(session.hours || 0),
    0
  );
}


// ======================================================
// DATE AND TIME
// ======================================================

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const [
    year,
    month,
    day
  ] =
    dateString.split("-");

  return `${month}-${day}-${year}`;
}


function formatTime(timeString) {
  if (!timeString) {
    return "";
  }

  const [
    hourText,
    minute
  ] =
    timeString.split(":");

  let hour =
    Number(hourText);

  const suffix =
    hour >= 12
      ? "PM"
      : "AM";

  hour =
    hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}


function getTodayDate() {
  const today =
    new Date();

  const year =
    today.getFullYear();

  const month =
    String(
      today.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      today.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}


// ======================================================
// MODALS
// ======================================================

function openModal(modalId) {
  const modal =
    document.getElementById(modalId);

  if (modal) {
    modal.classList.remove("hidden");
  }
}


function closeModal(modalId) {
  const modal =
    document.getElementById(modalId);

  if (modal) {
    modal.classList.add("hidden");
  }
}


// ======================================================
// BUTTON HELPERS
// ======================================================

function setButtonBusy(
  buttonId,
  busy,
  text
) {
  const button =
    document.getElementById(buttonId);

  if (!button) {
    return;
  }

  button.disabled =
    busy;

  button.textContent =
    text;
}


// ======================================================
// MESSAGE HELPERS
// ======================================================

function showMessage(
  element,
  text,
  type
) {
  if (!element) {
    return;
  }

  element.textContent =
    text;

  element.className =
    `message ${type}`;
}


function clearMessage(element) {
  if (!element) {
    return;
  }

  element.textContent =
    "";

  element.className =
    "message";
}


// ======================================================
// GENERAL HELPERS
// ======================================================

function capitalize(value) {
  const text =
    String(value || "");

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}


function csvEscape(value) {
  const text =
    String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
