const STORAGE_KEY = 'web-system-items-v1';
const form = document.getElementById('itemForm');
const nameInput = document.getElementById('nameInput');
const categoryInput = document.getElementById('categoryInput');
const notesInput = document.getElementById('notesInput');
const searchInput = document.getElementById('searchInput');
const clearSearchButton = document.getElementById('clearSearchButton');
const cancelEditButton = document.getElementById('cancelEditButton');
const logoutButton = document.getElementById('logoutButton');
const summaryGrid = document.getElementById('summaryGrid');
const itemList = document.getElementById('itemList');
const clearButton = document.getElementById('clearButton');

let items = loadItems();
let editingId = null;

function ensureAuthentication() {
  if (sessionStorage.getItem('authenticated') !== 'true') {
    window.location.href = 'login.html';
  }
}

form.addEventListener('submit', saveItem);
searchInput.addEventListener('input', render);
clearSearchButton.addEventListener('click', () => {
  searchInput.value = '';
  render();
});
cancelEditButton.addEventListener('click', cancelEdit);
logoutButton.addEventListener('click', () => {
  sessionStorage.removeItem('authenticated');
  window.location.href = 'login.html';
});
clearButton.addEventListener('click', () => {
  if (window.confirm('Deseja apagar todos os registros salvos?')) {
    items = [];
    saveItems();
    render();
  }
});

ensureAuthentication();
updateFormState();
render();

function saveItem(event) {
  event.preventDefault();

  const name = nameInput.value.trim();
  const category = categoryInput.value.trim();
  const notes = notesInput.value.trim();

  if (!name) return;

  if (editingId) {
    items = items.map((item) => item.id === editingId ? { ...item, name, category, notes } : item);
  } else {
    items.unshift({
      id: Date.now().toString(),
      name,
      category,
      notes,
      createdAt: new Date().toLocaleString('pt-BR')
    });
  }

  saveItems();
  form.reset();
  editingId = null;
  updateFormState();
  render();
}

function render() {
  const query = searchInput.value.toLowerCase();
  const filtered = items.filter((item) => {
    const haystack = `${item.name} ${item.category} ${item.notes}`.toLowerCase();
    return haystack.includes(query);
  });

  clearSearchButton.hidden = !query;

  summaryGrid.innerHTML = `
    <article class="summary-item">
      <strong>${items.length}</strong>
      <span>registros salvos</span>
    </article>
    <article class="summary-item">
      <strong>${new Set(items.map((item) => item.category)).size}</strong>
      <span>categorias</span>
    </article>
    <article class="summary-item">
      <strong>${filtered.length}</strong>
      <span>visíveis agora</span>
    </article>
    <article class="summary-item">
      <strong>${items.length ? escapeHtml(items[0].createdAt) : '—'}</strong>
      <span>último registro</span>
    </article>
  `;

  if (!filtered.length) {
    itemList.innerHTML = '<li class="empty">Nenhum registro encontrado.</li>';
    return;
  }

  itemList.innerHTML = filtered.map((item) => `
    <li class="item-card">
      <header>
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="meta">${escapeHtml(item.category || 'Sem categoria')}</div>
        </div>
        <div class="actions">
          <button class="action-btn" type="button" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="action-btn" type="button" data-action="delete" data-id="${item.id}">Excluir</button>
        </div>
      </header>
      <p>${escapeHtml(item.notes || 'Sem observações.')}</p>
      <div class="meta">Criado em ${escapeHtml(item.createdAt)}</div>
    </li>
  `).join('');

  itemList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id));
  });
}

function handleAction(action, id) {
  if (action === 'delete') {
    items = items.filter((item) => item.id !== id);
    saveItems();
    render();
    return;
  }

  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  editingId = item.id;
  nameInput.value = item.name;
  categoryInput.value = item.category || '';
  notesInput.value = item.notes || '';
  updateFormState();
  nameInput.focus();
}

function cancelEdit() {
  editingId = null;
  form.reset();
  updateFormState();
}

function updateFormState() {
  if (editingId) {
    cancelEditButton.hidden = false;
    form.querySelector('button[type="submit"]').textContent = 'Atualizar';
  } else {
    cancelEditButton.hidden = true;
    form.querySelector('button[type="submit"]').textContent = 'Salvar';
  }
}

function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
