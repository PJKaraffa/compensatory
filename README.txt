SPED COMPENSATORY SERVICES - SEPARATE FILE VERSION

FILES
login.html
index.html
style.css
login.js
app.js
supabase-config.js
setup.sql

GITHUB PAGES
Set login.html as the page users open first.

Example:
https://yourusername.github.io/your-project/login.html

SUPABASE SETUP
1. Run setup.sql.
2. Create users in Supabase Authentication.
3. Insert each user into public.profiles.
4. Use role administrator or provider.
5. Add your Supabase URL and anon key to supabase-config.js.

ADMIN EXAMPLE
insert into public.profiles (id, full_name, role)
values ('USER-UUID', 'PJ Karaffa', 'administrator');

PROVIDER EXAMPLE
insert into public.profiles (id, full_name, role)
values ('USER-UUID', 'Provider Name', 'provider');
