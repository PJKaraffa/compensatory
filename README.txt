SPED COMPENSATORY SERVICES V3 — PROVIDER ASSIGNMENTS

NEW FEATURES
- Every student has one assigned provider.
- Providers see only students assigned to their own account.
- Administrators see every student.
- Providers can enter services only for assigned students.
- Add/Edit Student includes an Assigned Provider dropdown.
- Administrators can import students from CSV.
- CSV rows include Provider Email.
- Existing collapsible student cards and approved visual design are preserved.

INSTALLATION
1. Upload the new HTML, CSS, and app.js files.
2. Keep your existing Supabase URL/key in supabase-config.js.
3. Run assignment_migration.sql once in Supabase SQL Editor.
4. Log out and back in.
5. Press Ctrl+F5.

CSV COLUMNS
Student ID
First Name
Last Name
School
Grade
Comp Hours
Provider Email

IMPORTANT
Provider accounts must already exist in Supabase Authentication and public.profiles.
The migration adds profiles.email and fills it from auth.users.

UNASSIGNED EXISTING STUDENTS
Existing students remain visible to administrators but are not visible to a provider
until the administrator edits the student and selects an Assigned Provider.
