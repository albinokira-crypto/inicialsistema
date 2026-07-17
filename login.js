const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

const registerForm = document.getElementById('registerForm');
const newUsernameInput = document.getElementById('newUsernameInput');
const newPasswordInput = document.getElementById('newPasswordInput');
const registerError = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');

const toggleLoginView = document.getElementById('toggleLoginView');
const toggleRegisterView = document.getElementById('toggleRegisterView');
const showRegisterLink = document.getElementById('showRegisterLink');
const showLoginLink = document.getElementById('showLoginLink');
const adminCredentialsHint = document.getElementById('adminCredentialsHint');

const validUser = 'admin';
const validPassword = '1234';
const USERS_STORAGE_KEY = 'web-system-users-v1';

// Toggle views
showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.hidden = true;
  registerForm.hidden = false;
  toggleLoginView.hidden = true;
  toggleRegisterView.hidden = false;
  adminCredentialsHint.hidden = true;
  registerError.hidden = true;
  registerSuccess.hidden = true;
  registerForm.reset();
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.hidden = false;
  registerForm.hidden = true;
  toggleLoginView.hidden = false;
  toggleRegisterView.hidden = true;
  adminCredentialsHint.hidden = false;
  loginError.hidden = true;
  loginForm.reset();
});

// Load registered users from localStorage
function getRegisteredUsers() {
  const raw = localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Falha ao ler usuários do localStorage:', error);
    return {};
  }
}

// Save registered users
function saveRegisteredUser(username, password) {
  const users = getRegisteredUsers();
  users[username] = password;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// Register handler
registerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  registerError.hidden = true;
  registerSuccess.hidden = true;

  const username = newUsernameInput.value.trim();
  const password = newPasswordInput.value.trim();

  if (!username || !password) {
    registerError.hidden = false;
    registerError.textContent = 'Por favor, preencha todos os campos.';
    return;
  }

  if (username.toLowerCase() === validUser) {
    registerError.hidden = false;
    registerError.textContent = 'Este nome de usuário já existe.';
    return;
  }

  const users = getRegisteredUsers();
  if (users[username]) {
    registerError.hidden = false;
    registerError.textContent = 'Este nome de usuário já existe.';
    return;
  }

  saveRegisteredUser(username, password);
  registerSuccess.hidden = false;
  registerForm.reset();
});

// Login handler
loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loginError.hidden = true;

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  // Check admin
  if (username === validUser && password === validPassword) {
    sessionStorage.setItem('authenticated', 'true');
    window.location.href = 'index.html';
    return;
  }

  // Check registered users
  const users = getRegisteredUsers();
  if (users[username] && users[username] === password) {
    sessionStorage.setItem('authenticated', 'true');
    window.location.href = 'index.html';
    return;
  }

  loginError.hidden = false;
  loginError.textContent = 'Usuário ou senha incorretos. Tente novamente.';
});

if (sessionStorage.getItem('authenticated') === 'true' && window.location.pathname.endsWith('login.html')) {
  window.location.href = 'index.html';
}
