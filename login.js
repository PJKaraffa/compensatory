document.addEventListener("DOMContentLoaded", initializeLogin);

async function initializeLogin() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("loginButton").addEventListener("click", login);

  document.getElementById("password").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      login();
    }
  });
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const message = document.getElementById("loginMessage");
  const button = document.getElementById("loginButton");

  clearMessage(message);

  if (!email || !password) {
    showMessage(message, "Enter your email and password.", "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Logging in...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  button.disabled = false;
  button.textContent = "Login";

  if (error) {
    showMessage(message, error.message, "error");
    return;
  }

  if (data.session) {
    window.location.href = "index.html";
  }
}

function showMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
}

function clearMessage(element) {
  element.textContent = "";
  element.className = "message";
}
