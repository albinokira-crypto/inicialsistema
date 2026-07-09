const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

const validUser = 'admin';
const validPassword = '1234';

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (username === validUser && password === validPassword) {
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
