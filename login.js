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

const USERS_STORAGE_KEY = 'web-system-users-v1';

// Toggle views
showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.style.display = 'none';
  registerForm.style.display = 'grid';
  toggleLoginView.style.display = 'none';
  toggleRegisterView.style.display = 'block';
  registerError.hidden = true;
  registerSuccess.hidden = true;
  registerForm.reset();
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.style.display = 'grid';
  registerForm.style.display = 'none';
  toggleLoginView.style.display = 'block';
  toggleRegisterView.style.display = 'none';
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

  // Check registered users
  const users = getRegisteredUsers();
  if (users[username] && users[username] === password) {
    localStorage.setItem('authenticated', 'true');
    window.location.href = 'dashboard.html';
    return;
  }

  loginError.hidden = false;
  loginError.textContent = 'Usuário ou senha incorretos. Tente novamente.';
});

if (localStorage.getItem('authenticated') === 'true') {
  window.location.href = 'dashboard.html';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      // Force checking for updates immediately on load
      registration.update();
    })
    .catch((error) => {
      console.warn('Registro do service worker falhou', error);
    });

  // Auto-reload when service worker updates to apply changes in real-time
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

// Backup Import Logic in login.js
const importBackupButton = document.getElementById('importBackupButton');
const backupFileInput = document.getElementById('backupFileInput');

if (importBackupButton && backupFileInput) {
  importBackupButton.addEventListener('click', () => {
    backupFileInput.click();
  });

  backupFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || typeof data !== 'object') {
          throw new Error('Formato de backup inválido.');
        }

        // Restore keys to localStorage
        Object.keys(data).forEach(key => {
          localStorage.setItem(key, data[key]);
        });

        alert('Backup importado com sucesso! Agora você já pode fazer login.');
        window.location.reload();
      } catch (err) {
        alert('Erro ao importar backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
}
