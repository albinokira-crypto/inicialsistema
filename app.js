const STORAGE_KEY = 'web-system-items-v1';
const form = document.getElementById('itemForm');
const dateInput = document.getElementById('dateInput');
const dayInput = document.getElementById('dayInput');
const plateInput = document.getElementById('plateInput');
const providerSelect = document.getElementById('providerSelect');
const valueInput = document.getElementById('valueInput');
const searchInput = document.getElementById('searchInput');
const clearSearchButton = document.getElementById('clearSearchButton');
const dayTabs = document.getElementById('dayTabs');
const cancelEditButton = document.getElementById('cancelEditButton');
const logoutButton = document.getElementById('logoutButton');
const summaryGrid = document.getElementById('summaryGrid');
const itemList = document.getElementById('itemList');
const reportBody = document.getElementById('reportBody');
const weeklyVisits = document.getElementById('weeklyVisits');
const weeklyValue = document.getElementById('weeklyValue');
const clearButton = document.getElementById('clearButton');
const installButton = document.getElementById('installButton');
const currentDateLabel = document.getElementById('currentDateLabel');
const currentDayLabel = document.getElementById('currentDayLabel');
const formTitle = document.getElementById('formTitle');
const insurerForm = document.getElementById('insurerForm');
const insurerNameInput = document.getElementById('insurerNameInput');
const insurerValueInput = document.getElementById('insurerValueInput');
const cancelInsurerEditButton = document.getElementById('cancelInsurerEditButton');
const insurerCard = document.getElementById('insurerCard');
const insurerList = document.getElementById('insurerList');
const formCard = document.getElementById('formCard');
const recordsCard = document.getElementById('recordsCard');
const reportCard = document.getElementById('reportCard');
const shareWhatsappButton = document.getElementById('shareWhatsappButton');
const noInsurersNote = document.getElementById('noInsurersNote');
const continueButton = document.getElementById('continueButton');
const welcomeScreen = document.getElementById('welcomeScreen');
const appContent = document.getElementById('appContent');

let deferredPrompt = null;
let items = loadItems();
let insurers = loadInsurers();
let editingId = null;
let editingInsurerId = null;
let selectedDay = 'Seguradoras';
let appInitialized = false;

function ensureAuthentication() {
  if (sessionStorage.getItem('authenticated') !== 'true') {
    window.location.href = 'login.html';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Registro do service worker falhou', error);
    });
  }
}

function attachGlobalEventListeners() {
  if (shareWhatsappButton) {
    shareWhatsappButton.addEventListener('click', () => {
      const text = buildWeeklyReportText();
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.location.href = url;
    });
  }
}

form.addEventListener('submit', saveItem);
searchInput.addEventListener('input', render);
clearSearchButton.addEventListener('click', () => {
  searchInput.value = '';
  render();
});
dayTabs.addEventListener('click', (event) => {
  const target = event.target;
  if (!target.matches('.tab-btn')) return;
  selectedDay = target.dataset.day;
  updateDayTabs();
  render();
});
cancelEditButton.addEventListener('click', cancelEdit);
logoutButton.addEventListener('click', () => {
  sessionStorage.removeItem('authenticated');
  window.location.href = 'login.html';
});
installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.hidden = true;
  if (choice.outcome === 'accepted') {
    console.log('Usuário aceitou o atalho');
  }
});
plateInput.addEventListener('input', formatPlateInput);
insurerForm.addEventListener('submit', saveInsurer);
cancelInsurerEditButton.addEventListener('click', cancelInsurerEdit);
providerSelect.addEventListener('change', () => {
  const selected = insurers.find((insurer) => insurer.id === providerSelect.value);
  if (selected) {
    valueInput.value = selected.price.toFixed(2);
  } else {
    valueInput.value = '';
  }
});
clearButton.addEventListener('click', () => {
  if (window.confirm('Deseja apagar todos os registros salvos?')) {
    items = [];
    saveItems();
    render();
  }
});

function formatPlateInput() {
  if (!plateInput) return;
  plateInput.value = normalizePlate(plateInput.value);
}

function normalizePlate(value) {
  if (!value) return '';
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length <= 3) return raw;
  if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}`;
}

function isValidPlate(value) {
  return /^[A-Z]{3}-?[0-9]{4}$/.test(value);
}

function cancelEdit() {
  editingId = null;
  form.reset();
  updateFormState();
  updateFormDisplay();
}

function cancelInsurerEdit() {
  editingInsurerId = null;
  insurerForm.reset();
  cancelInsurerEditButton.hidden = true;
}

function showWelcomeScreen() {
  if (welcomeScreen) welcomeScreen.hidden = false;
  if (appContent) appContent.hidden = true;
}

function attachWelcomeFlow() {
  if (!continueButton) return;

  continueButton.addEventListener('click', () => {
    if (welcomeScreen) welcomeScreen.hidden = true;
    if (appContent) appContent.hidden = false;
    initializeApp();
  });
}

function initializeApp() {
  if (appInitialized) return;
  appInitialized = true;

  try {
    selectedDay = 'Seguradoras';
    ensureAuthentication();
    registerServiceWorker();
    updateFormState();
    updateFormDisplay();
    updateDayTabs();
    render();
    renderInsurers();
  } catch (error) {
    console.error('Erro ao iniciar o app:', error);
  }
}

if (sessionStorage.getItem('authenticated') !== 'true') {
  window.location.href = 'login.html';
} else {
  showWelcomeScreen();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachWelcomeFlow);
  } else {
    attachWelcomeFlow();
  }
  attachGlobalEventListeners();
}

function saveItem(event) {
  event.preventDefault();

  const date = getTodayDateValue();
  const day = getSelectedSaveDay();
  const plate = normalizePlate(plateInput.value.trim());
  const providerId = providerSelect.value;
  const selectedInsurer = insurers.find((insurer) => insurer.id === providerId);
  const provider = selectedInsurer ? selectedInsurer.name : '';
  const value = selectedInsurer ? selectedInsurer.price : parseFloat(valueInput.value) || 0;

  if (!date || !day || !plate || !providerId) return;
  if (!isValidPlate(plate)) return;

  if (editingId) {
    items = items.map((item) => item.id === editingId ? { ...item, plate, provider, value, providerId } : item);
  } else {
    items.unshift({
      id: Date.now().toString(),
      date,
      day,
      plate,
      provider,
      providerId,
      value,
      createdAt: new Date().toLocaleString('pt-BR')
    });
  }

  saveItems();
  form.reset();
  editingId = null;
  updateFormState();
  updateFormDisplay();
  render();
}

function saveInsurer(event) {
  event.preventDefault();

  const name = insurerNameInput.value.trim();
  // accept comma as decimal separator; default to 0 when empty
  const raw = (insurerValueInput.value || '').toString().trim();
  const normalized = raw === '' ? '0' : raw.replace(',', '.');
  const price = parseFloat(normalized);
  if (!name) return;
  if (!Number.isFinite(price) || price < 0) return;

  if (editingInsurerId) {
    insurers = insurers.map((insurer) => insurer.id === editingInsurerId ? { ...insurer, name, price } : insurer);
  } else {
    insurers.push({
      id: Date.now().toString(),
      name,
      price
    });
  }

  saveInsurers();
  insurerForm.reset();
  editingInsurerId = null;
  cancelInsurerEditButton.hidden = true;
  renderInsurers();
  populateProviderSelect();
  // keep user on Seguradoras tab after saving
  selectedDay = 'Seguradoras';
  updateDayTabs();
  if (insurerForm) insurerForm.hidden = false;
  if (insurerCard) insurerCard.hidden = false;
  if (formCard) formCard.hidden = true;
  if (recordsCard) recordsCard.hidden = true;
  if (reportCard) reportCard.hidden = true;
  render();
}

function render() {
  const query = searchInput.value.toLowerCase();
  const filtered = items.filter((item) => {
    const isTotalWeek = selectedDay === 'Total da semana';
    const sameDay = item.day === selectedDay;
    const haystack = `${item.date} ${item.day} ${item.plate} ${item.provider}`.toLowerCase();
    return (isTotalWeek ? true : sameDay) && haystack.includes(query);
  });

  clearSearchButton.hidden = !query;
  installButton.hidden = !deferredPrompt;

  const totalValue = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const uniqueDays = new Set(items.map((item) => item.day)).size;

  summaryGrid.innerHTML = `
    <article class="summary-item">
      <strong>${items.length}</strong>
      <span>vistorias</span>
    </article>
    <article class="summary-item">
      <strong>R$ ${totalValue.toFixed(2).replace('.', ',')}</strong>
      <span>valor total</span>
    </article>
    <article class="summary-item">
      <strong>${uniqueDays}</strong>
      <span>dias preenchidos</span>
    </article>
    <article class="summary-item">
      <strong>${items.length ? escapeHtml(items[0].createdAt) : '—'}</strong>
      <span>último registro</span>
    </article>
  `;

  if (!filtered.length) {
    itemList.innerHTML = '<li class="empty">Nenhum registro encontrado.</li>';
    renderReport(filtered);
    return;
  }

  itemList.innerHTML = filtered.map((item) => `
    <li class="item-card">
      <header>
        <div class="plate-card">
          <div class="plate-badge">
            <span class="plate-badge-code">BR</span>
            <span class="plate-badge-text">${escapeHtml(item.plate)}</span>
          </div>
          <div>
            <strong>${escapeHtml(item.provider || 'Sem seguradora')}</strong>
            <div class="meta">${escapeHtml(item.day)} · ${escapeHtml(item.date)}</div>
          </div>
        </div>
        <div class="actions">
          <button class="action-btn" type="button" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="action-btn" type="button" data-action="delete" data-id="${item.id}">Excluir</button>
        </div>
      </header>
      <p class="plate-caption">Vistoria registrada com a placa do carro</p>
      <div class="meta">Valor: R$ ${escapeHtml(Number(item.value).toFixed(2).replace('.', ','))}</div>
      <div class="meta">Criado em ${escapeHtml(item.createdAt)}</div>
    </li>
  `).join('');

  itemList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id));
  });

  renderReport(filtered);
}

function renderReport(filteredItems) {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const totals = days.map((day) => {
    const itemsForDay = items.filter((item) => item.day === day);
    return {
      day,
      visits: itemsForDay.length,
      value: itemsForDay.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
    };
  });

  reportBody.innerHTML = totals.map(({ day, visits, value }) => `
    <tr>
      <td>${escapeHtml(day)}</td>
      <td>${visits}</td>
      <td>R$ ${value.toFixed(2).replace('.', ',')}</td>
    </tr>
  `).join('');

  const totalVisits = totals.reduce((sum, d) => sum + d.visits, 0);
  const totalValue = totals.reduce((sum, d) => sum + d.value, 0);
  weeklyVisits.textContent = totalVisits;
  weeklyValue.textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;
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
  plateInput.value = item.plate || '';
  providerSelect.value = item.providerId || '';
  valueInput.value = item.value || '';
  updateFormState();
  plateInput.focus();
}

function updateDayTabs() {
  dayTabs.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.day === selectedDay);
  });
  updateFormDisplay();
}

function updateFormDisplay() {
  const currentDate = new Date();
  const dateValue = getTodayDateValue();
  const currentDay = getSelectedSaveDay();
  const isInsurerPane = selectedDay === 'Seguradoras';

  if (currentDateLabel) {
    currentDateLabel.textContent = formatDateForDisplay(currentDate);
  }
  if (currentDayLabel) {
    currentDayLabel.textContent = currentDay;
  }
  if (dateInput) {
    dateInput.value = dateValue;
  }
  if (dayInput) {
    dayInput.value = currentDay;
  }

  if (formTitle) {
    formTitle.textContent = isInsurerPane ? 'Cadastre seguradoras' : 'Novo registro';
  }
  if (insurerForm) {
    insurerForm.hidden = selectedDay !== 'Seguradoras';
  }
  if (insurerCard) {
    insurerCard.hidden = selectedDay !== 'Seguradoras';
  }
  if (noInsurersNote) {
    noInsurersNote.hidden = selectedDay !== 'Seguradoras';
  }
  // control visibility of main cards depending on selected tab
  if (formCard) formCard.hidden = selectedDay === 'Seguradoras' || selectedDay === 'Total da semana';
  if (recordsCard) recordsCard.hidden = selectedDay === 'Seguradoras' || selectedDay === 'Total da semana';
  if (reportCard) reportCard.hidden = !(selectedDay === 'Total da semana');

  populateProviderSelect();
}

function populateProviderSelect() {
  if (!providerSelect) return;

  providerSelect.innerHTML = '<option value="">Selecione a seguradora</option>';
  insurers.forEach((insurer) => {
    providerSelect.innerHTML += `<option value="${insurer.id}">${escapeHtml(insurer.name)}</option>`;
  });

  if (!insurers.length) {
    noInsurersNote.hidden = false;
    providerSelect.disabled = true;
  } else {
    noInsurersNote.hidden = true;
    providerSelect.disabled = false;
  }
}

function renderInsurers() {
  if (!insurerList) return;

  insurerList.innerHTML = insurers.length
    ? insurers.map((insurer) => `
      <li class="item-card">
        <header>
          <div>
            <strong>${escapeHtml(insurer.name)}</strong>
            <div class="meta">R$ ${insurer.price.toFixed(2).replace('.', ',')}</div>
          </div>
          <div class="actions">
            <button class="action-btn" type="button" data-action="edit-insurer" data-id="${insurer.id}">Editar</button>
            <button class="action-btn" type="button" data-action="delete-insurer" data-id="${insurer.id}">Excluir</button>
          </div>
        </header>
      </li>
    `).join('')
    : '<li class="empty">Nenhuma seguradora cadastrada.</li>';

  insurerList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleInsurerAction(button.dataset.action, button.dataset.id));
  });
}

function handleInsurerAction(action, id) {
  if (action === 'delete-insurer') {
    insurers = insurers.filter((insurer) => insurer.id !== id);
    saveInsurers();
    renderInsurers();
    populateProviderSelect();
    return;
  }

  const insurer = insurers.find((entry) => entry.id === id);
  if (!insurer) return;

  editingInsurerId = insurer.id;
  insurerNameInput.value = insurer.name;
  insurerValueInput.value = insurer.price.toFixed(2);
  cancelInsurerEditButton.hidden = false;
}

function buildWeeklyReportText() {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  let lines = ['Relatório semanal - Vistorias'];
  let totalVisits = 0;
  let totalValue = 0;
  days.forEach((day) => {
    const itemsForDay = items.filter((item) => item.day === day);
    const visits = itemsForDay.length;
    const value = itemsForDay.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    lines.push(`${day}: ${visits} vistorias - R$ ${value.toFixed(2).replace('.', ',')}`);
    totalVisits += visits;
    totalValue += value;
  });
  lines.push(`Totais: ${totalVisits} vistorias - R$ ${totalValue.toFixed(2).replace('.', ',')}`);
  return lines.join('\n');
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

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function getSelectedSaveDay() {
  const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  if (weekdays.includes(selectedDay)) {
    return selectedDay;
  }
  return getWeekdayName(new Date());
}

function getWeekdayName(date) {
  const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return weekdayNames[date.getDay()];
}

function formatDateForDisplay(date) {
  return date.toLocaleDateString('pt-BR');
}

function safeParseJson(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Falha ao analisar JSON do localStorage:', error);
    return fallback;
  }
}

function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? safeParseJson(raw, []) : [];
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadInsurers() {
  const raw = localStorage.getItem('web-system-insurers-v1');
  return raw ? safeParseJson(raw, []) : [];
}

function saveInsurers() {
  localStorage.setItem('web-system-insurers-v1', JSON.stringify(insurers));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
