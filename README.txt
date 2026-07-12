SPED COMPENSATORY SERVICES V2 - COLLAPSIBLE STUDENTS

This version keeps the approved visual design and adds:

- Student cards collapsed by default
- Expand/collapse by clicking the student header
- Expand All and Collapse All buttons
- Session-count badges
- The selected student stays expanded after saving or deleting a service
- Correct district-wide remaining hours for providers
- Providers still see only their own individual service rows
- Administrators see all provider rows

FILES
login.html
index.html
style.css
login.js
app.js
supabase-config.js
setup.sql
README.txt

IMPORTANT SQL FUNCTION
The JavaScript requires public.get_student_hour_totals().
Use the function SQL already provided in the project setup.

UPLOAD
Upload all files to the same GitHub Pages folder.
Then use Ctrl+F5 to force the new JavaScript and CSS to load.
