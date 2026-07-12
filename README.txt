SPED COMPENSATORY SERVICES - CLEAN REBUILD

FILES
login.html
index.html
style.css
login.js
app.js
supabase-config.js
setup.sql

IMPORTANT
setup.sql drops and recreates profiles, students, and service_sessions.
Use it only when ready to replace the current application tables.

SETUP
1. Create users in Supabase Authentication.
2. Run setup.sql.
3. Insert each user into public.profiles using the Authentication UUID.
4. Add the Supabase URL and anon public key to supabase-config.js.
5. Upload all web files to GitHub Pages.
6. Open login.html.

ADMIN EXAMPLE
insert into public.profiles (id, full_name, role)
values ('AUTH-USER-UUID', 'PJ Karaffa', 'administrator');

PROVIDER EXAMPLE
insert into public.profiles (id, full_name, role)
values ('AUTH-USER-UUID', 'Provider Name', 'provider');
