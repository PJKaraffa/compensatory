// ======================================================
// SPED COMPENSATORY SERVICES
// COMPLETE APPLICATION JAVASCRIPT
// ======================================================

let currentUser = null;
let currentProfile = null;

let students = [];
let serviceSessions = [];
let studentHourTotals = [];
let providers = [];

const expandedStudentIds = new Set();
let lastOpenedStudentId = null;


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
  const logoutButton =
    document.getElementById("logoutButton");

  const refreshButton =
    document.getElementById("refreshButton");

  const addStudentButton =
    document.getElementById("addStudentButton");

  const saveStudentButton =
    document.getElementById("saveStudentButton");

  const saveServiceButton =
    document.getElementById("saveServiceButton");

  const exportButton =
    document.getElementById("exportButton");

  const importStudentsButton =
    document.getElementById("importStudentsButton");

  const downloadTemplateButton =
    document.getElementById("downloadTemplateButton");

  const studentCsvInput =
    document.getElementById("studentCsvInput");

  const searchInput =
    document.getElementById("searchInput");

  const schoolFilter =
    document.getElementById("schoolFilter");

  const studentList =
    document.getElementById("studentList");

  const expandAllButton =
    document.getElementById("expandAllButton");

  const collapseAllButton =
    document.getElementById("collapseAllButton");


  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      logout
    );
  }

  if (refreshButton) {
    refreshButton.addEventListener(
      "click",
      refreshDashboard
    );
  }

  if (addStudentButton) {
    addStudentButton.addEventListener(
      "click",
      openAddStudentModal
    );
  }

  if (saveStudentButton) {
    saveStudentButton.addEventListener(
      "click",
      saveStudent
    );
  }

  if (saveServiceButton) {
    saveServiceButton.addEventListener(
      "click",
      saveServiceSession
    );
  }

  if (exportButton) {
    exportButton.addEventListener(
      "click",
      exportCsv
    );
  }

  if (importStudentsButton) {
    importStudentsButton.addEventListener(
      "click",
      () => studentCsvInput?.click()
    );
  }

  if (downloadTemplateButton) {
    downloadTemplateButton.addEventListener(
      "click",
      downloadStudentTemplate
    );
  }

  if (studentCsvInput) {
    studentCsvInput.addEventListener(
      "change",
      importStudentsFromCsv
    );
  }

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      renderStudents
    );
  }

  if (schoolFilter) {
    schoolFilter.addEventListener(
      "change",
      renderStudents
    );
  }

  if (studentList) {
    studentList.addEventListener(
      "click",
      handleStudentButtonClick
    );
  }

  if (expandAllButton) {
    expandAllButton.addEventListener(
      "click",
      expandAllStudents
    );
  }

  if (collapseAllButton) {
    collapseAllButton.addEventListener(
      "click",
      collapseAllStudents
    );
  }

  document
    .querySelectorAll("[data-close]")
    .forEach(button => {
      button.addEventListener("click", () => {
        closeModal(button.dataset.close);
      });
    });

  document
    .querySelectorAll(".modal")
    .forEach(modal => {
      modal.addEventListener("click", event => {
        if (event.target === modal) {
          closeModal(modal.id);
        }
      });
    });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      document
        .querySelectorAll(".modal:not(.hidden)")
        .forEach(modal => {
          closeModal(modal.id);
        });
    }
  });
}


// ======================================================
// DYNAMIC BUTTON HANDLER
// ======================================================

function handleStudentButtonClick(event) {
  const button =
    event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  event.stopPropagation();

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

    case "toggle-student":
      toggleStudentDetails(studentId);
      break;
  }
}


// ======================================================
// LOAD CURRENT PROFILE
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
    console.error(
      "Profile load error:",
      error
    );

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

  const studentCountLabel =
    document.getElementById("studentCountLabel");

  const remainingLabel =
    document.getElementById("remainingLabel");

  const importStudentsButton =
    document.getElementById("importStudentsButton");

  const downloadTemplateButton =
    document.getElementById("downloadTemplateButton");


  if (welcomeMessage) {
    welcomeMessage.textContent =
      `${currentProfile.full_name || currentUser.email} • ${capitalize(currentProfile.role)}`;
  }

  if (studentCountLabel) {
    studentCountLabel.textContent =
      currentProfile.role === "administrator"
        ? "Students"
        : "Students Assigned";
  }

  if (completedLabel) {
    completedLabel.textContent =
      "Completed Hours";
  }

  if (remainingLabel) {
    remainingLabel.textContent =
      currentProfile.role === "administrator"
        ? "Hours Left"
        : "Hours Remaining";
  }

  if (addStudentButton) {
    if (
      currentProfile.role ===
      "administrator"
    ) {
      addStudentButton.classList.remove(
        "hidden"
      );

      importStudentsButton?.classList.remove(
        "hidden"
      );

      downloadTemplateButton?.classList.remove(
        "hidden"
      );
    } else {
      addStudentButton.classList.add(
        "hidden"
      );

      importStudentsButton?.classList.add(
        "hidden"
      );

      downloadTemplateButton?.classList.add(
        "hidden"
      );
    }
  }
}


// ======================================================
// LOGOUT
// ======================================================

async function logout() {
  const logoutButton =
    document.getElementById("logoutButton");

  if (logoutButton) {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";
  }

  const { error } =
    await supabaseClient.auth.signOut();

  if (error) {
    console.error("Logout error:", error);

    if (logoutButton) {
      logoutButton.disabled = false;
      logoutButton.textContent = "Logout";
    }

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
// REFRESH DASHBOARD
// ======================================================

async function refreshDashboard() {
  const refreshButton =
    document.getElementById(
      "refreshButton"
    );

  const originalText =
    refreshButton?.textContent ||
    "Refresh";

  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";
  }

  try {
    await loadDashboard();

    showMessage(
      document.getElementById(
        "appMessage"
      ),
      "Dashboard refreshed.",
      "success"
    );
  } catch (error) {
    console.error(
      "Refresh error:",
      error
    );

    showMessage(
      document.getElementById(
        "appMessage"
      ),
      error.message ||
      "The dashboard could not be refreshed.",
      "error"
    );
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent =
        originalText;
    }
  }
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
      .select(`
        *,
        assigned_provider:profiles!students_assigned_provider_id_fkey
        (
          id,
          full_name,
          email
        )
      `)
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

  const totalsRequest =
    supabaseClient
      .rpc("get_student_hour_totals");

  const providersRequest =
    currentProfile.role === "administrator"
      ? supabaseClient
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("role", "provider")
          .order("full_name")
      : Promise.resolve({
          data: [],
          error: null
        });

  const [
    studentResult,
    serviceResult,
    totalsResult,
    providersResult
  ] = await Promise.all([
    studentRequest,
    serviceRequest,
    totalsRequest,
    providersRequest
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

    throw studentResult.error;
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

    throw serviceResult.error;
  }

  if (providersResult.error) {
    console.error(
      "Provider load error:",
      providersResult.error
    );

    showMessage(
      appMessage,
      providersResult.error.message,
      "error"
    );

    throw providersResult.error;
  }

  if (totalsResult.error) {
    console.error(
      "Student totals error:",
      totalsResult.error
    );

    showMessage(
      appMessage,
      totalsResult.error.message,
      "error"
    );

    throw totalsResult.error;
  }

  students =
    studentResult.data || [];

  serviceSessions =
    serviceResult.data || [];

  studentHourTotals =
    totalsResult.data || [];

  providers =
    providersResult.data || [];

  buildProviderDropdown();
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

  const expandAllButton =
    document.getElementById("expandAllButton");

  const collapseAllButton =
    document.getElementById("collapseAllButton");

  const searchInput =
    document.getElementById("searchInput");

  const schoolFilter =
    document.getElementById("schoolFilter");

  const searchText =
    searchInput
      ? searchInput.value
          .trim()
          .toLowerCase()
      : "";

  const selectedSchool =
    schoolFilter
      ? schoolFilter.value
      : "";

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
        student.grade,
        student.assigned_provider?.full_name,
        student.assigned_provider?.email
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

      return (
        matchesSearch &&
        matchesSchool
      );
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
  const allVisibleStudentSessions =
    serviceSessions.filter(
      session =>
        sameId(
          session.student_id,
          student.id
        )
    );

  const providerSessions =
    allVisibleStudentSessions.filter(
      session =>
        sameId(
          session.provider_id,
          currentUser.id
        )
    );

  const visibleSessions =
    currentProfile.role ===
    "administrator"
      ? allVisibleStudentSessions
      : providerSessions;

  const studentTotals =
    getStudentHourTotal(
      student.id
    );

  const totalCompleted =
    studentTotals.completedHours;

  const providerCompleted =
    sumHours(
      providerSessions
    );

  const assignedHours =
    Number(
      student.comp_hours || 0
    );

  const hoursLeft =
    studentTotals.hoursLeft;

  const studentKey =
    String(student.id);

  const isExpanded =
    expandedStudentIds.has(
      studentKey
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
    currentProfile.role ===
    "administrator"
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
    currentProfile.role ===
    "administrator"
      ? "Completed Hours"
      : "My Hours";

  const completedValue =
    currentProfile.role ===
    "administrator"
      ? totalCompleted
      : providerCompleted;

  const sessionCount =
    visibleSessions.length;

  const sessionLabel =
    sessionCount === 1
      ? "1 Session"
      : `${sessionCount} Sessions`;

  return `
    <article
      class="student-card ${isExpanded ? "expanded" : "collapsed"}"
      data-student-card-id="${student.id}"
    >

      <div
        class="student-header student-toggle-area"
        data-action="toggle-student"
        data-student-id="${student.id}"
        role="button"
        tabindex="0"
        aria-expanded="${isExpanded}"
      >

        <div class="student-main student-title-block">

          <div class="student-name-row">
            <span
              class="expand-arrow"
              aria-hidden="true"
            >
              ${isExpanded ? "▼" : "▶"}
            </span>

            <div>
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

              ${
                currentProfile.role === "administrator"
                  ? `
                    <span class="provider-badge">
                      Assigned:
                      ${escapeHtml(
                        student.assigned_provider?.full_name ||
                        "Unassigned"
                      )}
                    </span>
                  `
                  : ""
              }
            </div>
          </div>

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

          <span class="session-badge">
            ${sessionLabel}
          </span>

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


      <div
        class="student-details ${isExpanded ? "" : "hidden"}"
      >

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
    currentProfile.role ===
    "administrator"
    ||
    sameId(
      session.provider_id,
      currentUser.id
    );

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
  /*
    The students array is already restricted by RLS:

    Administrator:
      All active students.

    Provider:
      Only active students assigned to the logged-in provider.

    get_student_hour_totals() follows the same assignment rule, while
    counting every service delivered to each visible student. Therefore,
    the dashboard shows the actual workload totals rather than only the
    sessions entered by the logged-in provider.
  */

  const totalAssigned =
    students.reduce(
      (sum, student) =>
        sum +
        Number(
          student.comp_hours || 0
        ),
      0
    );

  const totalCompleted =
    studentHourTotals.reduce(
      (sum, item) =>
        sum +
        Number(
          item.completed_hours || 0
        ),
      0
    );

  const totalRemaining =
    studentHourTotals.reduce(
      (sum, item) =>
        sum +
        Number(
          item.hours_left || 0
        ),
      0
    );

  setText(
    "studentCount",
    students.length
  );

  setText(
    "assignedHours",
    totalAssigned.toFixed(2)
  );

  setText(
    "completedHours",
    totalCompleted.toFixed(2)
  );

  setText(
    "remainingHours",
    totalRemaining.toFixed(2)
  );
}

// ======================================================
// SCHOOL FILTER
// ======================================================

function buildSchoolFilter() {
  const schoolFilter =
    document.getElementById(
      "schoolFilter"
    );

  if (!schoolFilter) {
    return;
  }

  const currentValue =
    schoolFilter.value;

  const schools = [
    ...new Set(
      students
        .map(student =>
          student.school
        )
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

  if (
    schools.includes(
      currentValue
    )
  ) {
    schoolFilter.value =
      currentValue;
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

  setText(
    "studentModalTitle",
    "Add Student"
  );

  setValue(
    "studentRecordId",
    ""
  );

  setValue(
    "studentId",
    ""
  );

  setValue(
    "firstName",
    ""
  );

  setValue(
    "lastName",
    ""
  );

  setValue(
    "school",
    ""
  );

  setValue(
    "grade",
    ""
  );

  setValue(
    "compHours",
    ""
  );

  setValue(
    "assignedProvider",
    ""
  );

  clearMessage(
    document.getElementById(
      "studentMessage"
    )
  );

  openModal(
    "studentModal"
  );
}


// ======================================================
// EDIT STUDENT MODAL
// ======================================================

function openEditStudentModal(
  studentId
) {
  if (
    currentProfile.role !==
    "administrator"
  ) {
    return;
  }

  const student =
    students.find(
      item =>
        sameId(
          item.id,
          studentId
        )
    );

  if (!student) {
    alert(
      "Student record not found."
    );

    return;
  }

  setText(
    "studentModalTitle",
    "Edit Student"
  );

  setValue(
    "studentRecordId",
    student.id
  );

  setValue(
    "studentId",
    student.student_id
  );

  setValue(
    "firstName",
    student.first_name
  );

  setValue(
    "lastName",
    student.last_name
  );

  setValue(
    "school",
    student.school
  );

  setValue(
    "grade",
    student.grade
  );

  setValue(
    "compHours",
    student.comp_hours
  );

  setValue(
    "assignedProvider",
    student.assigned_provider_id || ""
  );

  clearMessage(
    document.getElementById(
      "studentMessage"
    )
  );

  openModal(
    "studentModal"
  );
}


// ======================================================
// SAVE STUDENT
// ======================================================

async function saveStudent() {
  const studentMessage =
    document.getElementById(
      "studentMessage"
    );

  clearMessage(
    studentMessage
  );

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
    getValue(
      "studentRecordId"
    );

  const studentData = {
    student_id:
      getValue(
        "studentId"
      ).trim(),

    first_name:
      getValue(
        "firstName"
      ).trim(),

    last_name:
      getValue(
        "lastName"
      ).trim(),

    school:
      getValue(
        "school"
      ).trim(),

    grade:
      getValue(
        "grade"
      ).trim(),

    comp_hours:
      Number(
        getValue(
          "compHours"
        )
      ),

    assigned_provider_id:
      getValue(
        "assignedProvider"
      ) || null,

    active:
      true
  };

  if (
    !studentData.student_id
    ||
    !studentData.first_name
    ||
    !studentData.last_name
    ||
    !studentData.school
    ||
    !studentData.grade
    ||
    Number.isNaN(
      studentData.comp_hours
    )
    ||
    studentData.comp_hours < 0
    ||
    !studentData.assigned_provider_id
  ) {
    showMessage(
      studentMessage,
      "Complete every student field and select an assigned provider.",
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
        .eq(
          "id",
          recordId
        );
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

  closeModal(
    "studentModal"
  );

  await loadDashboard();
}


// ======================================================
// OPEN SERVICE MODAL
// ======================================================

function openServiceModal(
  studentId
) {
  const student =
    students.find(
      item =>
        sameId(
          item.id,
          studentId
        )
    );

  if (!student) {
    console.error(
      "Student not found:",
      studentId,
      students
    );

    alert(
      "Student record not found."
    );

    return;
  }

  setValue(
    "serviceStudentId",
    student.id
  );

  setText(
    "serviceStudentName",
    `${student.last_name}, ${student.first_name} • ${student.student_id}`
  );

  setValue(
    "serviceDate",
    getTodayDate()
  );

  setValue(
    "startTime",
    ""
  );

  setValue(
    "endTime",
    ""
  );

  setValue(
    "serviceNotes",
    ""
  );

  clearMessage(
    document.getElementById(
      "serviceMessage"
    )
  );

  openModal(
    "serviceModal"
  );
}


// ======================================================
// SAVE SERVICE SESSION
// ======================================================

async function saveServiceSession() {
  const serviceMessage =
    document.getElementById(
      "serviceMessage"
    );

  clearMessage(
    serviceMessage
  );

  const studentId =
    getValue(
      "serviceStudentId"
    );

  const serviceDate =
    getValue(
      "serviceDate"
    );

  const startTime =
    getValue(
      "startTime"
    );

  const endTime =
    getValue(
      "endTime"
    );

  const notes =
    getValue(
      "serviceNotes"
    ).trim();

  if (
    !studentId
    ||
    !serviceDate
    ||
    !startTime
    ||
    !endTime
    ||
    !notes
  ) {
    showMessage(
      serviceMessage,
      "Enter the date, start time, end time, and service notes.",
      "error"
    );

    return;
  }

  const calculatedHours =
    calculateHours(
      startTime,
      endTime
    );

  if (
    calculatedHours <= 0
  ) {
    showMessage(
      serviceMessage,
      "End time must be after start time.",
      "error"
    );

    return;
  }

  const student =
    students.find(
      item =>
        sameId(
          item.id,
          studentId
        )
    );

  if (!student) {
    showMessage(
      serviceMessage,
      "Student record not found.",
      "error"
    );

    return;
  }

  const studentTotals =
    getStudentHourTotal(
      studentId
    );

  const hoursLeft =
    studentTotals.hoursLeft;

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
          student.id,

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
          notes
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

  lastOpenedStudentId =
    String(student.id);

  expandedStudentIds.add(
    String(student.id)
  );

  closeModal(
    "serviceModal"
  );

  await loadDashboard();
}


// ======================================================
// DELETE SERVICE SESSION
// ======================================================

async function deleteServiceSession(
  sessionId
) {
  const session =
    serviceSessions.find(
      item =>
        sameId(
          item.id,
          sessionId
        )
    );

  if (!session) {
    alert(
      "Service session not found."
    );

    return;
  }

  const canDelete =
    currentProfile.role ===
    "administrator"
    ||
    sameId(
      session.provider_id,
      currentUser.id
    );

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
      .eq(
        "id",
        sessionId
      );

  if (error) {
    console.error(
      "Delete session error:",
      error
    );

    showMessage(
      document.getElementById(
        "appMessage"
      ),
      error.message,
      "error"
    );

    return;
  }

  lastOpenedStudentId =
    String(session.student_id);

  expandedStudentIds.add(
    String(session.student_id)
  );

  await loadDashboard();
}


// ======================================================
// REMOVE / DEACTIVATE STUDENT
// ======================================================

async function deactivateStudent(
  studentId
) {
  if (
    currentProfile.role !==
    "administrator"
  ) {
    return;
  }

  const student =
    students.find(
      item =>
        sameId(
          item.id,
          studentId
        )
    );

  if (!student) {
    alert(
      "Student record not found."
    );

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
        active:
          false
      })
      .eq(
        "id",
        student.id
      );

  if (error) {
    console.error(
      "Deactivate student error:",
      error
    );

    showMessage(
      document.getElementById(
        "appMessage"
      ),
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
      "Notes",
      "Assigned Provider",
      "Assigned Provider Email"
    ]
  ];

  students.forEach(student => {
    const studentSessions =
      serviceSessions.filter(
        session =>
          sameId(
            session.student_id,
            student.id
          )
      );

    const visibleSessions =
      currentProfile.role ===
      "administrator"
        ? studentSessions
        : studentSessions.filter(
            session =>
              sameId(
                session.provider_id,
                currentUser.id
              )
          );

    const studentTotals =
      getStudentHourTotal(
        student.id
      );

    const totalCompleted =
      studentTotals.completedHours;

    const hoursLeft =
      studentTotals.hoursLeft;

    if (
      !visibleSessions.length
    ) {
      rows.push([
        student.student_id,
        `${student.last_name}, ${student.first_name}`,
        student.school,
        student.grade,
        Number(
          student.comp_hours || 0
        ).toFixed(2),
        totalCompleted.toFixed(2),
        hoursLeft.toFixed(2),
        "",
        "",
        "",
        "",
        "",
        "",
        student.assigned_provider?.full_name || "",
        student.assigned_provider?.email || ""
      ]);

      return;
    }

    visibleSessions.forEach(
      session => {
        rows.push([
          student.student_id,
          `${student.last_name}, ${student.first_name}`,
          student.school,
          student.grade,
          Number(
            student.comp_hours || 0
          ).toFixed(2),
          totalCompleted.toFixed(2),
          hoursLeft.toFixed(2),
          session.provider?.full_name || "Provider",
          formatDate(
            session.service_date
          ),
          formatTime(
            session.start_time
          ),
          formatTime(
            session.end_time
          ),
          Number(
            session.hours || 0
          ).toFixed(2),
          session.notes || "",
          student.assigned_provider?.full_name || "",
          student.assigned_provider?.email || ""
        ]);
      }
    );
  });

  const csv =
    rows
      .map(row =>
        row
          .map(value =>
            csvEscape(value)
          )
          .join(",")
      )
      .join("\n");

  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.download =
    `sped_compensatory_services_${getTodayDate()}.csv`;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  URL.revokeObjectURL(
    url
  );
}


// ======================================================
// EXPAND / COLLAPSE STUDENT CARDS
// ======================================================

function toggleStudentDetails(
  studentId
) {
  const key =
    String(studentId);

  if (
    expandedStudentIds.has(key)
  ) {
    expandedStudentIds.delete(key);
  } else {
    expandedStudentIds.add(key);
    lastOpenedStudentId = key;
  }

  renderStudents();
}


function expandAllStudents() {
  students.forEach(student => {
    expandedStudentIds.add(
      String(student.id)
    );
  });

  renderStudents();
}


function collapseAllStudents() {
  expandedStudentIds.clear();
  lastOpenedStudentId = null;

  renderStudents();
}


// ======================================================
// PROVIDER DROPDOWN
// ======================================================

function buildProviderDropdown() {
  const select =
    document.getElementById(
      "assignedProvider"
    );

  if (!select) {
    return;
  }

  const currentValue =
    select.value;

  select.innerHTML =
    `<option value="">Select Provider</option>` +
    providers
      .map(provider => `
        <option value="${escapeHtml(provider.id)}">
          ${escapeHtml(provider.full_name)}
          ${provider.email ? ` — ${escapeHtml(provider.email)}` : ""}
        </option>
      `)
      .join("");

  select.value =
    providers.some(provider =>
      sameId(
        provider.id,
        currentValue
      )
    )
      ? currentValue
      : "";
}


// ======================================================
// STUDENT CSV TEMPLATE
// ======================================================

function downloadStudentTemplate() {
  const rows = [
    [
      "Student ID",
      "First Name",
      "Last Name",
      "School",
      "Grade",
      "Comp Hours",
      "Provider Email"
    ],
    [
      "123456",
      "John",
      "Smith",
      "Central High School",
      "12",
      "25",
      "provider@bridgeportedu.net"
    ]
  ];

  downloadCsvRows(
    rows,
    "student_import_template.csv"
  );
}


// ======================================================
// IMPORT STUDENTS FROM CSV
// ======================================================

async function importStudentsFromCsv(event) {
  const file =
    event.target.files?.[0];

  event.target.value = "";

  if (!file) {
    return;
  }

  if (
    currentProfile.role !==
    "administrator"
  ) {
    alert(
      "Only administrators can import students."
    );

    return;
  }

  const text =
    await file.text();

  const rows =
    parseCsv(text);

  if (rows.length < 2) {
    showImportResults(
      0,
      [
        "The CSV file does not contain any student rows."
      ]
    );

    return;
  }

  const headers =
    rows[0].map(value =>
      normalizeHeader(value)
    );

  const requiredHeaders = [
    "studentid",
    "firstname",
    "lastname",
    "school",
    "grade",
    "comphours",
    "provideremail"
  ];

  const missingHeaders =
    requiredHeaders.filter(header =>
      !headers.includes(header)
    );

  if (missingHeaders.length) {
    showImportResults(
      0,
      [
        `Missing columns: ${missingHeaders.join(", ")}`
      ]
    );

    return;
  }

  const providerByEmail =
    new Map(
      providers
        .filter(provider =>
          provider.email
        )
        .map(provider => [
          provider.email
            .trim()
            .toLowerCase(),
          provider
        ])
    );

  const records = [];
  const errors = [];

  rows
    .slice(1)
    .forEach((row, index) => {
      const rowNumber =
        index + 2;

      if (
        row.every(value =>
          !String(value || "").trim()
        )
      ) {
        return;
      }

      const record = {};

      headers.forEach(
        (header, columnIndex) => {
          record[header] =
            String(
              row[columnIndex] ?? ""
            ).trim();
        }
      );

      const provider =
        providerByEmail.get(
          record.provideremail
            .toLowerCase()
        );

      const compHours =
        Number(
          record.comphours
        );

      if (
        !record.studentid ||
        !record.firstname ||
        !record.lastname ||
        !record.school ||
        !record.grade ||
        !record.provideremail
      ) {
        errors.push(
          `Row ${rowNumber}: One or more required values are blank.`
        );

        return;
      }

      if (
        Number.isNaN(compHours) ||
        compHours < 0
      ) {
        errors.push(
          `Row ${rowNumber}: Comp Hours must be zero or greater.`
        );

        return;
      }

      if (!provider) {
        errors.push(
          `Row ${rowNumber}: No provider profile was found for ${record.provideremail}.`
        );

        return;
      }

      records.push({
        student_id:
          record.studentid,

        first_name:
          record.firstname,

        last_name:
          record.lastname,

        school:
          record.school,

        grade:
          record.grade,

        comp_hours:
          compHours,

        assigned_provider_id:
          provider.id,

        active:
          true,

        created_by:
          currentUser.id
      });
    });

  if (!records.length) {
    showImportResults(
      0,
      errors
    );

    return;
  }

  const { error } =
    await supabaseClient
      .from("students")
      .upsert(
        records,
        {
          onConflict:
            "student_id"
        }
      );

  if (error) {
    errors.unshift(
      error.message
    );

    showImportResults(
      0,
      errors
    );

    return;
  }

  showImportResults(
    records.length,
    errors
  );

  await loadDashboard();
}


function showImportResults(
  importedCount,
  errors
) {
  const results =
    document.getElementById(
      "importResults"
    );

  if (!results) {
    return;
  }

  results.innerHTML = `
    <div class="import-summary">
      ${importedCount} student record${importedCount === 1 ? "" : "s"} imported or updated.
    </div>

    ${
      errors.length
        ? `
            <ul class="import-errors">
              ${errors
                .map(error =>
                  `<li>${escapeHtml(error)}</li>`
                )
                .join("")}
            </ul>
          `
        : ""
    }
  `;

  openModal(
    "importModal"
  );
}


function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "");
}


function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const character =
      text[index];

    const nextCharacter =
      text[index + 1];

    if (
      character === '"'
      &&
      quoted
      &&
      nextCharacter === '"'
    ) {
      value += '"';
      index += 1;
      continue;
    }

    if (
      character === '"'
    ) {
      quoted = !quoted;
      continue;
    }

    if (
      character === ","
      &&
      !quoted
    ) {
      row.push(value);
      value = "";
      continue;
    }

    if (
      (character === "\n" ||
       character === "\r")
      &&
      !quoted
    ) {
      if (
        character === "\r"
        &&
        nextCharacter === "\n"
      ) {
        index += 1;
      }

      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  if (
    value.length ||
    row.length
  ) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}


function downloadCsvRows(
  rows,
  filename
) {
  const csv =
    rows
      .map(row =>
        row
          .map(value =>
            csvEscape(value)
          )
          .join(",")
      )
      .join("\n");

  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.download =
    filename;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  URL.revokeObjectURL(
    url
  );
}


// ======================================================
// STUDENT TOTALS
// ======================================================

function getStudentHourTotal(
  studentId
) {
  const total =
    studentHourTotals.find(
      item =>
        sameId(
          item.student_id,
          studentId
        )
    );

  return {
    completedHours:
      Number(
        total?.completed_hours || 0
      ),

    hoursLeft:
      Number(
        total?.hours_left || 0
      )
  };
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

  if (
    difference <= 0
  ) {
    return 0;
  }

  return (
    Math.round(
      (difference / 60) *
      100
    ) / 100
  );
}


// ======================================================
// SUM HOURS
// ======================================================

function sumHours(
  sessions
) {
  return sessions.reduce(
    (
      sum,
      session
    ) =>
      sum +
      Number(
        session.hours || 0
      ),
    0
  );
}


// ======================================================
// DATE AND TIME
// ======================================================

function formatDate(
  dateString
) {
  if (!dateString) {
    return "";
  }

  const [
    year,
    month,
    day
  ] =
    dateString.split("-");

  return (
    `${month}-${day}-${year}`
  );
}


function formatTime(
  timeString
) {
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

  return (
    `${hour}:${minute} ${suffix}`
  );
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

  return (
    `${year}-${month}-${day}`
  );
}


// ======================================================
// MODALS
// ======================================================

function openModal(
  modalId
) {
  const modal =
    document.getElementById(
      modalId
    );

  if (modal) {
    modal.classList.remove(
      "hidden"
    );
  }
}


function closeModal(
  modalId
) {
  const modal =
    document.getElementById(
      modalId
    );

  if (modal) {
    modal.classList.add(
      "hidden"
    );
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
    document.getElementById(
      buttonId
    );

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


function clearMessage(
  element
) {
  if (!element) {
    return;
  }

  element.textContent =
    "";

  element.className =
    "message";
}


// ======================================================
// DOM HELPERS
// ======================================================

function setText(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (element) {
    element.textContent =
      value;
  }
}


function setValue(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (element) {
    element.value =
      value ?? "";
  }
}


function getValue(
  elementId
) {
  const element =
    document.getElementById(
      elementId
    );

  return element
    ? element.value
    : "";
}


// ======================================================
// ID COMPARISON
// ======================================================

function sameId(
  value1,
  value2
) {
  return (
    String(value1) ===
    String(value2)
  );
}


// ======================================================
// GENERAL HELPERS
// ======================================================

function capitalize(
  value
) {
  const text =
    String(value || "");

  return (
    text
      .charAt(0)
      .toUpperCase()
    +
    text.slice(1)
  );
}


function csvEscape(
  value
) {
  const text =
    String(value ?? "");

  if (
    text.includes(",")
    ||
    text.includes('"')
    ||
    text.includes("\n")
  ) {
    return (
      `"${text.replaceAll('"', '""')}"`
    );
  }

  return text;
}


function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}
