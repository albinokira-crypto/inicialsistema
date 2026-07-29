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

function downloadJsonFile(filename, jsonString) {
  if (window.AndroidInterface && typeof window.AndroidInterface.exportBackup === 'function') {
    window.AndroidInterface.exportBackup(filename, jsonString);
    return;
  }

  try {
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (e) {}
      }, 1500);
      return;
    }
  } catch (e) {
    console.warn('createObjectURL falhou, usando fallback Data URI:', e);
  }

  try {
    const encodedData = encodeURIComponent(jsonString);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodedData;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.target = '_blank';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try { document.body.removeChild(link); } catch (e) {}
    }, 1000);
  } catch (err) {
    alert('Erro ao gerar arquivo de backup: ' + err.message);
  }
}

// Backup Export & Import Logic in login.js
const exportEmergencyBackupBtn = document.getElementById('exportEmergencyBackupBtn');
if (exportEmergencyBackupBtn) {
  exportEmergencyBackupBtn.addEventListener('click', async () => {
    try {
      const backup = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        backup[key] = localStorage.getItem(key);
      }
      const jsonString = JSON.stringify(backup, null, 2);
      const filename = `backup_vistoria_${new Date().toISOString().slice(0, 10)}.json`;

      downloadJsonFile(filename, jsonString);
    } catch (err) {
      alert('Erro ao exportar backup: ' + err.message);
    }
  });
}

const importBackupButton = document.getElementById('importBackupButton');
const importPasteBackupLoginBtn = document.getElementById('importPasteBackupLoginBtn');
const backupFileInput = document.getElementById('backupFileInput');

function restoreBackupInLogin(jsonString) {
  try {
    const data = JSON.parse(jsonString.trim());
    if (!data || typeof data !== 'object') {
      throw new Error('Formato de backup inválido.');
    }
    Object.keys(data).forEach(key => {
      localStorage.setItem(key, data[key]);
    });
    alert('✅ Backup importado com sucesso! Agora você já pode fazer login no sistema.');
    window.location.reload();
  } catch (err) {
    alert('Erro ao importar backup: ' + err.message);
  }
}

if (importBackupButton && backupFileInput) {
  importBackupButton.addEventListener('click', () => {
    backupFileInput.click();
  });

  backupFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      restoreBackupInLogin(e.target.result);
    };
    reader.readAsText(file);
  });
}

if (importPasteBackupLoginBtn) {
  importPasteBackupLoginBtn.addEventListener('click', () => {
    const jsonInput = prompt('Cole abaixo o código de backup (JSON):');
    if (jsonInput && jsonInput.trim()) {
      restoreBackupInLogin(jsonInput);
    }
  });
}
