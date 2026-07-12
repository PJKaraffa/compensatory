```javascript
// ======================================================
// SPED COMPENSATORY SERVICES
// MAIN APPLICATION JAVASCRIPT
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

    const profileLoaded = await loadCurrentProfile();

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

    const searchInput =
        document.getElementById("searchInput");

    const schoolFilter =
        document.getElementById("schoolFilter");


    if (logoutButton) {
        logoutButton.addEventListener(
            "click",
            logout
        );
    }


    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            loadDashboard
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


    document
        .querySelectorAll("[data-close]")
        .forEach(button => {

            button.addEventListener(
                "click",
                function () {

                    closeModal(
                        button.dataset.close
                    );

                }
            );

        });

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
        .select(
            "id, full_name, role"
        )
        .eq(
            "id",
            currentUser.id
        )
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
        document.getElementById(
            "welcomeMessage"
        );

    const addStudentButton =
        document.getElementById(
            "addStudentButton"
        );


    if (welcomeMessage) {

        welcomeMessage.textContent =
            `${currentProfile.full_name || currentUser.email} • ${capitalize(currentProfile.role)}`;

    }


    if (addStudentButton) {

        if (
            currentProfile.role ===
            "administrator"
        ) {

            addStudentButton.classList.remove(
                "hidden"
            );

        } else {

            addStudentButton.classList.add(
                "hidden"
            );

        }

    }

}


// ======================================================
// LOGOUT
// ======================================================

async function logout() {

    await supabaseClient.auth.signOut();

    redirectToLogin();

}


function redirectToLogin() {

    window.location.href =
        "login.html";

}


// ======================================================
// LOAD DASHBOARD
// ======================================================

async function loadDashboard() {

    const appMessage =
        document.getElementById(
            "appMessage"
        );

    clearMessage(appMessage);


    const studentRequest =
        supabaseClient
            .from("students")
            .select("*")
            .eq("active", true)
            .order(
                "lastname",
                {
                    ascending: true
                }
            )
            .order(
                "firstname",
                {
                    ascending: true
                }
            );


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
            .order(
                "service_date",
                {
                    ascending: false
                }
            )
            .order(
                "start_time",
                {
                    ascending: false
                }
            );


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
        document.getElementById(
            "studentList"
        );

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const schoolFilter =
        document.getElementById(
            "schoolFilter"
        );


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

            const studentFullName =
                getStudentName(student)
                    .toLowerCase();


            const searchableValues = [

                student.studentid,

                student.firstname,

                student.lastname,

                studentFullName,

                student.school,

                student.grade

            ];


            const matchesSearch =
                searchableValues.some(
                    value =>
                        String(value || "")
                            .toLowerCase()
                            .includes(searchText)
                );


            const matchesSchool =
                !selectedSchool ||
                student.school ===
                selectedSchool;


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
            .map(student => {

                return buildStudentCard(
                    student
                );

            })
            .join("");

}


// ======================================================
// BUILD STUDENT CARD
// ======================================================

function buildStudentCard(student) {

    const allStudentSessions =
        serviceSessions.filter(
            session =>
                Number(
                    session.student_id
                ) ===
                Number(
                    student.id
                )
        );


    let visibleSessions =
        allStudentSessions;


    if (
        currentProfile.role ===
        "provider"
    ) {

        visibleSessions =
            allStudentSessions.filter(
                session =>
                    session.provider_id ===
                    currentUser.id
            );

    }


    const totalCompleted =
        sumHours(
            allStudentSessions
        );


    const providerCompleted =
        sumHours(
            allStudentSessions.filter(
                session =>
                    session.provider_id ===
                    currentUser.id
            )
        );


    const assignedHours =
        Number(
            student.comp_hours || 0
        );


    const hoursLeft =
        Math.max(
            0,
            assignedHours -
            totalCompleted
        );


    const studentName =
        getStudentName(student);


    const serviceRows =
        buildServiceRows(
            visibleSessions
        );


    const administratorButtons =
        currentProfile.role ===
        "administrator"
            ? `
                <button
                    class="secondary-button small-button"
                    type="button"
                    onclick="openEditStudentModal('${student.id}')"
                >
                    Edit Student
                </button>

                <button
                    class="danger-button small-button"
                    type="button"
                    onclick="deleteStudent('${student.id}')"
                >
                    Delete Student
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


    return `
        <article class="student-card">

            <div class="student-header">

                <div class="student-main">

                    <h2>
                        ${escapeHtml(studentName)}
                    </h2>

                    <p>
                        ID:
                        ${escapeHtml(student.studentid)}

                        •
                        ${escapeHtml(student.school || "")}

                        • Grade
                        ${escapeHtml(student.grade || "")}
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
                        class="small-button"
                        type="button"
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

                            <th>
                                Provider
                            </th>

                            <th>
                                Date
                            </th>

                            <th>
                                Start Time
                            </th>

                            <th>
                                End Time
                            </th>

                            <th>
                                Hours
                            </th>

                            <th>
                                Notes
                            </th>

                            <th>
                                Action
                            </th>

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
// BUILD SERVICE SESSION ROWS
// ======================================================

function buildServiceRows(sessions) {

    if (!sessions.length) {

        return `
            <tr>

                <td
                    colspan="7"
                    class="empty-row"
                >
                    No service sessions recorded.
                </td>

            </tr>
        `;

    }


    return sessions
        .map(session => {

            const providerName =
                session.provider?.full_name ||
                "Provider";


            const deleteButton =
                canDeleteSession(session)
                    ? `
                        <button
                            class="danger-button small-button"
                            type="button"
                            onclick="deleteServiceSession('${session.id}')"
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

        })
        .join("");

}


// ======================================================
// DASHBOARD SUMMARY
// ======================================================

function renderSummary() {

    const totalAssigned =
        students.reduce(
            (
                total,
                student
            ) =>
                total +
                Number(
                    student.comp_hours || 0
                ),
            0
        );


    const totalCompleted =
        sumHours(
            serviceSessions
        );


    const providerCompleted =
        sumHours(
            serviceSessions.filter(
                session =>
                    session.provider_id ===
                    currentUser.id
            )
        );


    const displayedCompleted =
        currentProfile.role ===
        "administrator"
            ? totalCompleted
            : providerCompleted;


    const totalRemaining =
        Math.max(
            0,
            totalAssigned -
            totalCompleted
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
        displayedCompleted.toFixed(2)
    );


    setText(
        "remainingHours",
        totalRemaining.toFixed(2)
    );

}


// ======================================================
// BUILD SCHOOL FILTER
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
                .map(
                    student =>
                        student.school
                )
                .filter(Boolean)

        )

    ].sort();


    schoolFilter.innerHTML = `
        <option value="">
            All Schools
        </option>

        ${schools
            .map(
                school => `
                    <option
                        value="${escapeHtml(school)}"
                    >
                        ${escapeHtml(school)}
                    </option>
                `
            )
            .join("")}
    `;


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
// OPEN ADD STUDENT MODAL
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
        "studentNumber",
        ""
    );


    setValue(
        "studentName",
        ""
    );


    setValue(
        "studentSchool",
        ""
    );


    setValue(
        "studentGrade",
        ""
    );


    setValue(
        "compHours",
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
// OPEN EDIT STUDENT MODAL
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
                Number(item.id) ===
                Number(studentId)
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
        "studentNumber",
        student.studentid
    );


    setValue(
        "studentName",
        getStudentName(student)
    );


    setValue(
        "studentSchool",
        student.school || ""
    );


    setValue(
        "studentGrade",
        student.grade || ""
    );


    setValue(
        "compHours",
        student.comp_hours
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


    const studentRecordId =
        getValue(
            "studentRecordId"
        );


    const studentId =
        getValue(
            "studentNumber"
        ).trim();


    const fullName =
        getValue(
            "studentName"
        ).trim();


    const school =
        getValue(
            "studentSchool"
        ).trim();


    const grade =
        getValue(
            "studentGrade"
        ).trim();


    const compHours =
        Number(
            getValue(
                "compHours"
            )
        );


    if (
        !studentId ||
        !fullName ||
        !school ||
        !grade ||
        Number.isNaN(compHours) ||
        compHours < 0
    ) {

        showMessage(
            studentMessage,
            "Complete every student field.",
            "error"
        );

        return;

    }


    const parsedName =
        parseStudentName(
            fullName
        );


    if (
        !parsedName.firstname ||
        !parsedName.lastname
    ) {

        showMessage(
            studentMessage,
            "Enter the student's name as Last Name, First Name.",
            "error"
        );

        return;

    }


    const studentData = {

        studentid:
            studentId,

        firstname:
            parsedName.firstname,

        lastname:
            parsedName.lastname,

        school:
            school,

        grade:
            grade,

        comp_hours:
            compHours,

        active:
            true

    };


    setButtonBusy(
        "saveStudentButton",
        true,
        "Saving..."
    );


    let result;


    if (studentRecordId) {

        result =
            await supabaseClient
                .from("students")
                .update(studentData)
                .eq(
                    "id",
                    studentRecordId
                );

    } else {

        studentData.created_by =
            currentUser.id;


        result =
            await supabaseClient
                .from("students")
                .insert(
                    studentData
                );

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
                Number(item.id) ===
                Number(studentId)
        );


    if (!student) {

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
        `${getStudentName(student)} • ${student.studentid}`
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
                Number(item.id) ===
                Number(studentId)
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
                    Number(
                        session.student_id
                    ) ===
                    Number(
                        studentId
                    )
            )

        );


    const hoursLeft =
        Number(
            student.comp_hours || 0
        ) -
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


    const {
        error
    } = await supabaseClient
        .from("service_sessions")
        .insert({

            student_id:
                Number(studentId),

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
                Number(item.id) ===
                Number(sessionId)
        );


    if (!session) {

        alert(
            "Service session not found."
        );

        return;

    }


    if (
        !canDeleteSession(session)
    ) {

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


    const {
        error
    } = await supabaseClient
        .from("service_sessions")
        .delete()
        .eq(
            "id",
            sessionId
        );


    if (error) {

        console.error(
            "Delete service error:",
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
// DELETE / DEACTIVATE STUDENT
// ======================================================

async function deleteStudent(
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
                Number(item.id) ===
                Number(studentId)
        );


    if (!student) {

        alert(
            "Student record not found."
        );

        return;

    }


    const confirmed =
        confirm(
            `Remove ${getStudentName(student)} from the active student list?`
        );


    if (!confirmed) {
        return;
    }


    /*
        The student is made inactive instead of being
        permanently deleted. This preserves all service
        history.
    */

    const {
        error
    } = await supabaseClient
        .from("students")
        .update({

            active:
                false

        })
        .eq(
            "id",
            studentId
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
// PERMISSION CHECKS
// ======================================================

function canDeleteSession(
    session
) {

    return (

        currentProfile.role ===
        "administrator"

        ||

        session.provider_id ===
        currentUser.id

    );

}


// ======================================================
// STUDENT NAME FUNCTIONS
// ======================================================

function getStudentName(
    student
) {

    const lastname =
        student.lastname || "";

    const firstname =
        student.firstname || "";


    if (
        lastname &&
        firstname
    ) {

        return `${lastname}, ${firstname}`;

    }


    return (
        lastname ||
        firstname ||
        "Unnamed Student"
    );

}


function parseStudentName(
    fullName
) {

    const cleanedName =
        fullName.trim();


    if (
        cleanedName.includes(",")
    ) {

        const nameParts =
            cleanedName.split(",");


        const lastname =
            nameParts
                .shift()
                .trim();


        const firstname =
            nameParts
                .join(",")
                .trim();


        return {

            firstname:
                firstname,

            lastname:
                lastname

        };

    }


    const nameParts =
        cleanedName
            .split(/\s+/)
            .filter(Boolean);


    if (
        nameParts.length === 1
    ) {

        return {

            firstname:
                "",

            lastname:
                nameParts[0]

        };

    }


    const lastname =
        nameParts.pop();


    const firstname =
        nameParts.join(" ");


    return {

        firstname:
            firstname,

        lastname:
            lastname

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


    const differenceMinutes =
        endMinutes -
        startMinutes;


    if (
        differenceMinutes <= 0
    ) {

        return 0;

    }


    const hours =
        differenceMinutes / 60;


    return (
        Math.round(
            hours * 100
        ) / 100
    );

}


// ======================================================
// TOTAL HOURS
// ======================================================

function sumHours(
    sessions
) {

    return sessions.reduce(

        (
            total,
            session
        ) =>

            total +
            Number(
                session.hours || 0
            ),

        0

    );

}


// ======================================================
// DATE AND TIME FORMATTING
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
// MODAL FUNCTIONS
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
// BUTTON FUNCTIONS
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
// MESSAGE FUNCTIONS
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
// GENERAL HELPERS
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


// ======================================================
// MAKE FUNCTIONS AVAILABLE TO HTML BUTTONS
// ======================================================

window.openEditStudentModal =
    openEditStudentModal;


window.openServiceModal =
    openServiceModal;


window.deleteServiceSession =
    deleteServiceSession;


window.deleteStudent =
    deleteStudent;
```
