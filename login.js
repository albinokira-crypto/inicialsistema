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
  const defaultUsers = {
    "admin": "1234",
    "Diego": "Irons365.",
    "diego": "Irons365."
  };
  if (!raw) {
    return defaultUsers;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
      return defaultUsers;
    }
    if (!parsed["admin"]) parsed["admin"] = "1234";
    if (!parsed["Diego"]) parsed["Diego"] = "Irons365.";
    if (!parsed["diego"]) parsed["diego"] = "Irons365.";
    return parsed;
  } catch (error) {
    console.warn('Falha ao ler usuários do localStorage:', error);
    return defaultUsers;
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
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
  navigator.serviceWorker.register('/sw.js?v=201')
    .then((registration) => {
      registration.update();
    })
    .catch((error) => {
      console.warn('Registro do service worker falhou', error);
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
const submitPasteBackupLoginBtn = document.getElementById('submitPasteBackupLoginBtn');

function repairTruncatedJson(str) {
  if (!str) throw new Error('O texto de backup informado está vazio.');
  str = str.trim();
  try {
    const directParse = JSON.parse(str);
    if (directParse && typeof directParse === 'object') return directParse;
  } catch (e) {
    console.warn('JSON.parse direto falhou, iniciando reparo automático...', e);
  }

  let fixedStr = str;
  // Se houver aspas não fechadas, fecha aspas no final
  let quoteCount = 0;
  for (let i = 0; i < fixedStr.length; i++) {
    if (fixedStr[i] === '"' && (i === 0 || fixedStr[i-1] !== '\\')) {
      quoteCount++;
    }
  }
  if (quoteCount % 2 !== 0) {
    fixedStr += '"';
  }

  // Remove pontuações truncadas no final
  fixedStr = fixedStr.replace(/[,:]\s*"?$/, '');

  // Conta chaves e colchetes abertos
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  for (let i = 0; i < fixedStr.length; i++) {
    const ch = fixedStr[i];
    if (ch === '"' && (i === 0 || fixedStr[i-1] !== '\\')) {
      inString = !inString;
    }
    if (!inString) {
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }
  }

  while (openBrackets > 0) {
    fixedStr += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    fixedStr += '}';
    openBraces--;
  }

  try {
    const parsed = JSON.parse(fixedStr);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {
    console.warn('Reparo automático de estrutura falhou, extraindo chaves via expressões regulares...', e);
  }

  // Extrator por Regex para resgatar o máximo de chaves do localStorage salvas
  const result = {};
  const kvRegex = /"([^"\\]+)"\s*:\s*("(?:[^"\\]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?)/g;
  let match;
  while ((match = kvRegex.exec(str)) !== null) {
    try {
      const k = match[1];
      const v = JSON.parse(match[2]);
      result[k] = v;
    } catch(err) {}
  }

  if (Object.keys(result).length > 0) {
    return result;
  }

  throw new Error('Não foi possível ler o código do backup. Certifique-se de colar o código completo.');
}

function restoreBackupInLogin(jsonString) {
  try {
    const data = repairTruncatedJson(jsonString);
    let restoredKeys = 0;
    Object.keys(data).forEach(key => {
      localStorage.setItem(key, data[key]);
      restoredKeys++;
    });
    alert(`✅ Backup importado com sucesso! (${restoredKeys} chaves restauradas). Agora você já pode entrar no sistema.`);
    window.location.reload();
  } catch (err) {
    alert('Erro ao importar backup: ' + err.message);
  }
}

function openPasteImportLoginModal() {
  const modal = document.getElementById('backupPasteImportLoginModal');
  const txt = document.getElementById('pasteBackupLoginTextarea');
  if (txt) txt.value = '';
  if (modal) modal.style.display = 'flex';
}

function closePasteImportLoginModal() {
  const modal = document.getElementById('backupPasteImportLoginModal');
  if (modal) modal.style.display = 'none';
}

window.openPasteImportLoginModal = openPasteImportLoginModal;
window.closePasteImportLoginModal = closePasteImportLoginModal;

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
  importPasteBackupLoginBtn.addEventListener('click', openPasteImportLoginModal);
}

if (submitPasteBackupLoginBtn) {
  submitPasteBackupLoginBtn.addEventListener('click', () => {
    const txt = document.getElementById('pasteBackupLoginTextarea');
    if (txt) {
      restoreBackupInLogin(txt.value);
    }
  });
}
