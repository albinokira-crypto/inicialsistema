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
const clearWeekButton = document.getElementById('clearWeekButton');
const clearMonthButton = document.getElementById('clearMonthButton');
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
const sharePdfButton = document.getElementById('sharePdfButton');
const noInsurersNote = document.getElementById('noInsurersNote');
const welcomeScreen = document.getElementById('welcomeScreen');
const appContent = document.getElementById('appContent');
const backToMenuButton = document.getElementById('backToMenuButton');
const currentPageTitle = document.getElementById('currentPageTitle');
const insurerButtonsContainer = document.getElementById('insurerButtonsContainer');
const typeInput = document.getElementById('typeInput');

// Vistoria sub-tabs
const vistoriaTypeTabsCard = document.getElementById('vistoriaTypeTabsCard');
const vistoriaTypeTabs = document.getElementById('vistoriaTypeTabs');

// Dynamic Survey Fields Container
const dynamicFieldsContainer = document.getElementById('dynamicFieldsContainer');

// Oficinas Elements
const oficinaCard = document.getElementById('oficinaCard');
const oficinaForm = document.getElementById('oficinaForm');
const oficinaNameInput = document.getElementById('oficinaNameInput');
const cancelOficinaEditButton = document.getElementById('cancelOficinaEditButton');
const oficinaList = document.getElementById('oficinaList');

// Supervisão Elements
const supervisaoFormCard = document.getElementById('supervisaoFormCard');
const supervisaoRecordsCard = document.getElementById('supervisaoRecordsCard');
const supervisaoForm = document.getElementById('supervisaoForm');
const supervisaoVehicleInput = document.getElementById('supervisaoVehicleInput');
const supervisaoOficinaSelect = document.getElementById('supervisaoOficinaSelect');
const supervisaoAttendedInput = document.getElementById('supervisaoAttendedInput');
const supervisaoStageInput = document.getElementById('supervisaoStageInput');
const supervisaoPartsPendingButtons = document.getElementById('supervisaoPartsPendingButtons');
const supervisaoPartsPendingInput = document.getElementById('supervisaoPartsPendingInput');
const supervisaoPartsDetailsContainer = document.getElementById('supervisaoPartsDetailsContainer');
const supervisaoPartsInput = document.getElementById('supervisaoPartsInput');
const supervisaoArrivalInput = document.getElementById('supervisaoArrivalInput');
const supervisaoOtherInput = document.getElementById('supervisaoOtherInput');
const supervisaoFinishInput = document.getElementById('supervisaoFinishInput');
const saveSupervisaoButton = document.getElementById('saveSupervisaoButton');
const cancelSupervisaoEditButton = document.getElementById('cancelSupervisaoEditButton');
const shareSupervisaoTextButton = document.getElementById('shareSupervisaoTextButton');
const copySupervisaoTextButton = document.getElementById('copySupervisaoTextButton');
const supervisaoStageFilterContainer = document.getElementById('supervisaoStageFilterContainer');
const supervisaoOficinaFilterContainer = document.getElementById('supervisaoOficinaFilterContainer');
const supervisaoReportContent = document.getElementById('supervisaoReportContent');

let deferredPrompt = null;
let items = loadItems();
let insurers = loadInsurers();
let oficinas = loadOficinas();
let supervisoes = loadSupervisoes();
let editingId = null;
let editingInsurerId = null;
let editingOficinaId = null;
let editingSupervisaoId = null;
let selectedDay = 'Seguradoras';
let selectedType = 'Inicial';
let appInitialized = false;
let selectedSupervisaoStage = 'Todos';
let selectedSupervisaoOficina = 'Todas';

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installButton) installButton.hidden = false;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (installButton) installButton.hidden = true;
  console.log('App instalado');
});

function ensureAuthentication() {
  if (sessionStorage.getItem('authenticated') !== 'true') {
    window.location.href = 'index.html';
  }
}

function registerServiceWorker() {
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
}

function attachGlobalEventListeners() {
  if (sharePdfButton) {
    sharePdfButton.addEventListener('click', () => {
      generateWeeklyReportPDF();
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
  
  if (['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].includes(selectedDay)) {
    selectedType = 'Inicial';
    if (vistoriaTypeTabs) {
      vistoriaTypeTabs.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.type === 'Inicial');
      });
    }
    if (typeInput) typeInput.value = 'Inicial';
    const formTitle = document.getElementById('formTitle');
    if (formTitle) {
      formTitle.textContent = `Novo registro - Inicial`;
    }
  }

  updateDayTabs();
  render();
});
cancelEditButton.addEventListener('click', cancelEdit);
logoutButton.addEventListener('click', () => {
  sessionStorage.removeItem('authenticated');
  window.location.href = 'index.html';
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
insurerForm.addEventListener('submit', saveInsurer);
cancelInsurerEditButton.addEventListener('click', cancelInsurerEdit);

if (oficinaForm) {
  oficinaForm.addEventListener('submit', saveOficina);
}
if (cancelOficinaEditButton) {
  cancelOficinaEditButton.addEventListener('click', cancelOficinaEdit);
}
if (clearWeekButton) {
  clearWeekButton.addEventListener('click', () => {
    if (window.confirm('Deseja apagar os registros da semana atual? Eles continuarão no relatório mensal.')) {
      items.forEach((item) => {
        item.clearedFromWeek = true;
      });
      saveItems();
      render();
    }
  });
}

if (clearMonthButton) {
  clearMonthButton.addEventListener('click', () => {
    if (window.confirm('Deseja apagar permanentemente todos os registros do mês vigente?')) {
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      items = items.filter((item) => !item.date.startsWith(currentYearMonth));
      supervisoes = supervisoes.filter((s) => !s.date.startsWith(currentYearMonth));
      saveItems();
      saveSupervisoes();
      render();
      renderSupervisaoReport();
    }
  });
}

if (vistoriaTypeTabs) {
  vistoriaTypeTabs.addEventListener('click', (event) => {
    const btn = event.target;
    if (!btn.matches('.tab-btn')) return;
    selectedType = btn.dataset.type;
    vistoriaTypeTabs.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.type === selectedType);
    });
    if (typeInput) typeInput.value = selectedType;
    
    const formTitle = document.getElementById('formTitle');
    if (formTitle) {
      formTitle.textContent = `Novo registro - ${selectedType}`;
    }
    
    renderDynamicSurveyFields();
    render();
  });
}

if (supervisaoForm) {
  supervisaoForm.addEventListener('submit', saveSupervisao);
}

if (cancelSupervisaoEditButton) {
  cancelSupervisaoEditButton.addEventListener('click', cancelSupervisaoEdit);
}

if (supervisaoPartsPendingButtons) {
  supervisaoPartsPendingButtons.addEventListener('click', (event) => {
    const btn = event.target;
    if (!btn.matches('.type-btn')) return;
    const value = btn.dataset.value;
    if (supervisaoPartsPendingInput) supervisaoPartsPendingInput.value = value;
    supervisaoPartsPendingButtons.querySelectorAll('.type-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.value === value);
    });
    
    if (supervisaoPartsDetailsContainer) {
      supervisaoPartsDetailsContainer.style.display = value === 'Sim' ? 'block' : 'none';
      if (value === 'Sim') {
        if (supervisaoPartsInput) supervisaoPartsInput.required = true;
        if (supervisaoArrivalInput) supervisaoArrivalInput.required = true;
      } else {
        if (supervisaoPartsInput) supervisaoPartsInput.required = false;
        if (supervisaoArrivalInput) supervisaoArrivalInput.required = false;
      }
    }
  });
}

if (supervisaoStageFilterContainer) {
  supervisaoStageFilterContainer.addEventListener('click', (event) => {
    const btn = event.target;
    if (!btn.matches('.type-btn')) return;
    selectedSupervisaoStage = btn.dataset.filterStage;
    supervisaoStageFilterContainer.querySelectorAll('.type-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.filterStage === selectedSupervisaoStage);
    });
    renderSupervisaoReport();
  });
}

if (supervisaoOficinaFilterContainer) {
  supervisaoOficinaFilterContainer.addEventListener('click', (event) => {
    const btn = event.target;
    if (!btn.matches('.type-btn')) return;
    selectedSupervisaoOficina = btn.dataset.filterOficina;
    supervisaoOficinaFilterContainer.querySelectorAll('.type-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.filterOficina === selectedSupervisaoOficina);
    });
    renderSupervisaoReport();
  });
}

if (shareSupervisaoTextButton) {
  shareSupervisaoTextButton.addEventListener('click', () => {
    const filtered = getFilteredSupervisoes();
    const text = formatAllSupervisoesText(filtered);
    shareSupervisaoText(text, 'Relatório de Supervisão');
  });
}

if (copySupervisaoTextButton) {
  copySupervisaoTextButton.addEventListener('click', () => {
    const filtered = getFilteredSupervisoes();
    const text = formatAllSupervisoesText(filtered);
    copySupervisaoTextToClipboard(text);
  });
}

function formatPlateInput() {
  // No-op (plate and model are combined)
}

function normalizePlate(value) {
  return value ? value.toUpperCase().trim() : '';
}

function isValidPlate(value) {
  return value && value.trim().length > 0;
}

function cancelEdit() {
  editingId = null;
  form.reset();
  if (providerSelect) providerSelect.value = '';
  if (typeInput) typeInput.value = selectedType || 'Inicial';
  updateTypeButtonsHighlight();
  updateInsurerButtonsHighlight();
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

function attachMenuListeners() {
  const menuButtons = document.querySelectorAll('.menu-btn');
  menuButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDay = btn.dataset.day;
      initializeApp();
      
      if (['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].includes(selectedDay)) {
        selectedType = 'Inicial';
        if (vistoriaTypeTabs) {
          vistoriaTypeTabs.querySelectorAll('.tab-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.type === 'Inicial');
          });
        }
        if (typeInput) typeInput.value = 'Inicial';
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
          formTitle.textContent = `Novo registro - Inicial`;
        }
      }
      
      if (welcomeScreen) welcomeScreen.hidden = true;
      if (appContent) appContent.hidden = false;

      updateDayTabs();
      render();

      updatePageTitleHeader();
    });
  });

  if (backToMenuButton) {
    backToMenuButton.addEventListener('click', () => {
      showWelcomeScreen();
    });
  }
}

function initializeApp() {
  if (appInitialized) return;
  appInitialized = true;

  try {
    ensureAuthentication();
    registerServiceWorker();
    updateFormState();
    populateProviderSelect();
    render();
    renderInsurers();
    renderOficinas();
  } catch (error) {
    console.error('Erro ao iniciar o app:', error);
  }
}

if (sessionStorage.getItem('authenticated') !== 'true') {
  window.location.href = 'index.html';
} else {
  registerServiceWorker();
  initializeApp();
  showWelcomeScreen();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachMenuListeners);
  } else {
    attachMenuListeners();
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
  const type = typeInput ? typeInput.value : 'Inicial';

  // Read oficina
  const oficinaSelect = document.getElementById('itemOficinaSelect');
  const oficinaId = oficinaSelect ? oficinaSelect.value : '';
  const selectedOficina = oficinas.find(o => o.id === oficinaId);
  const oficinaName = selectedOficina ? selectedOficina.name : '';

  if (!date || !day || !plate || !providerId || !oficinaId) {
    alert('Por favor, preencha todos os campos obrigatórios, incluindo a oficina.');
    return;
  }
  if (!isValidPlate(plate)) return;

  // Gather details dynamically
  const details = {};
  if (dynamicFieldsContainer) {
    const inputs = dynamicFieldsContainer.querySelectorAll('input, select, textarea');
    inputs.forEach((input) => {
      if (input.name && input.name !== 'oficinaId') {
        details[input.name] = input.value;
      }
    });
  }

  if (editingId) {
    items = items.map((item) => item.id === editingId ? { 
      ...item, plate, provider, value, providerId, type, oficinaId, oficinaName, details 
    } : item);
  } else {
    items.unshift({
      id: Date.now().toString(),
      date,
      day,
      plate,
      provider,
      providerId,
      value,
      type,
      oficinaId,
      oficinaName,
      details,
      createdAt: new Date().toLocaleString('pt-BR')
    });
  }

  saveItems();
  form.reset();
  if (providerSelect) providerSelect.value = '';
  if (typeInput) typeInput.value = selectedType || 'Inicial';
  updateTypeButtonsHighlight();
  updateInsurerButtonsHighlight();
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
  const isTotalMonth = selectedDay === 'Mês vigente';

  if (isTotalMonth) {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthItems = items.filter((item) => {
      if (!item.date || !item.date.startsWith(currentYearMonth)) return false;
      const match = `${item.date} ${item.day} ${item.plate} ${item.provider} ${item.oficinaName || ''} ${item.type || ''}`.toLowerCase().includes(query);
      return match;
    }).map(i => ({ ...i, isSupervisao: false }));

    const monthSupervisoes = supervisoes.filter((s) => {
      if (!s.date || !s.date.startsWith(currentYearMonth)) return false;
      const match = `${s.date} ${s.day} ${s.vehicle} ${s.attended} ${s.stage} ${s.oficinaName || ''}`.toLowerCase().includes(query);
      return match;
    }).map(s => ({ ...s, isSupervisao: true }));

    const combined = [...monthItems, ...monthSupervisoes];
    combined.sort((a, b) => b.id.localeCompare(a.id));

    clearSearchButton.hidden = !query;
    installButton.hidden = !deferredPrompt;

    const totalValue = monthItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const allDates = [...monthItems.map(i => i.day), ...monthSupervisoes.map(s => s.day)];
    const uniqueDays = new Set(allDates).size;

    summaryGrid.innerHTML = `
      <article class="summary-item">
        <strong>${combined.length}</strong>
        <span>registros no mês</span>
      </article>
      <article class="summary-item">
        <strong>R$ ${totalValue.toFixed(2).replace('.', ',')}</strong>
        <span>valor total vistorias</span>
      </article>
      <article class="summary-item">
        <strong>${uniqueDays}</strong>
        <span>dias com registros</span>
      </article>
      <article class="summary-item">
        <strong>${combined.length ? escapeHtml(combined[0].createdAt || combined[0].date) : '—'}</strong>
        <span>último registro</span>
      </article>
    `;

    if (!combined.length) {
      itemList.innerHTML = '<li class="empty">Nenhum registro encontrado no mês vigente.</li>';
      renderReport([]);
      return;
    }

    const badgeClasses = {
      'Inicial': 'badge-inicial',
      'Roubo Recuperado': 'badge-roubo',
      'Incêndio': 'badge-incendio',
      'Enchente': 'badge-enchente',
      'Moto': 'badge-moto',
      'Complemento': 'badge-complemento',
      'Pós entrega': 'badge-pos'
    };

    itemList.innerHTML = combined.map((entry) => {
      if (entry.isSupervisao) {
        return `
          <li class="item-card compact-item-card">
            <div class="item-main-info">
              <div class="plate-badge compact-plate-badge">
                <span class="plate-badge-text">${escapeHtml(entry.vehicle || 'Supervisão')}</span>
              </div>
              <div class="item-details">
                <strong class="item-provider">Atendido: ${escapeHtml(entry.attended || '—')}</strong>
                <span class="item-meta">· ${escapeHtml(formatDateString(entry.date))}</span>
                <span class="badge-supervisao" style="margin-left: 6px;">
                  Supervisão: ${escapeHtml(entry.stage || '')}
                </span>
                ${entry.oficinaName ? `<div class="item-meta" style="margin-top: 4px; color: var(--color-slate-700);">Oficina: <strong>${escapeHtml(entry.oficinaName)}</strong></div>` : ''}
              </div>
            </div>
            <div class="actions vertical-actions">
              <button class="action-btn" type="button" data-super-action="share-text" data-id="${entry.id}">📱 Compartilhar</button>
              <button class="action-btn" type="button" data-super-action="copy-text" data-id="${entry.id}">📋 Copiar</button>
              <button class="action-btn" type="button" data-super-action="edit" data-id="${entry.id}">Editar</button>
              <button class="action-btn" type="button" data-super-action="delete" data-id="${entry.id}">Excluir</button>
            </div>
          </li>
        `;
      } else {
        const badgeClass = badgeClasses[entry.type || 'Inicial'] || 'badge-inicial';
        return `
          <li class="item-card compact-item-card">
            <div class="item-main-info">
              <div class="plate-badge compact-plate-badge">
                <span class="plate-badge-text">${escapeHtml(entry.plate)}</span>
              </div>
              <div class="item-details">
                <strong class="item-provider">${escapeHtml(entry.provider || 'Sem seguradora')}</strong>
                <span class="item-meta">· ${escapeHtml(formatDateString(entry.date))}</span>
                <strong class="item-value">· R$ ${escapeHtml(Number(entry.value).toFixed(2).replace('.', ','))}</strong>
                <span class="${badgeClass}" style="margin-left: 6px;">
                  ${escapeHtml(entry.type || 'Inicial')}
                </span>
                ${entry.oficinaName ? `<div class="item-meta" style="margin-top: 4px; color: var(--color-slate-700);">Oficina: <strong>${escapeHtml(entry.oficinaName)}</strong></div>` : ''}
              </div>
            </div>
            <div class="actions vertical-actions">
              <button class="action-btn" type="button" data-action="share-text" data-id="${entry.id}">📱 Compartilhar</button>
              <button class="action-btn" type="button" data-action="copy-text" data-id="${entry.id}">📋 Copiar</button>
              <button class="action-btn" type="button" data-action="edit" data-id="${entry.id}">Editar</button>
              <button class="action-btn" type="button" data-action="delete" data-id="${entry.id}">Excluir</button>
            </div>
          </li>
        `;
      }
    }).join('');

    itemList.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id));
    });

    itemList.querySelectorAll('[data-super-action]').forEach((button) => {
      button.addEventListener('click', () => handleSupervisaoAction(button.dataset.superAction, button.dataset.id));
    });

    renderReport(monthItems);
    return;
  }

  // Normal day filtering for regular vistorias
  const filtered = items.filter((item) => {
    const isTotalWeek = selectedDay === 'Total da semana';
    const matchesQuery = `${item.date} ${item.day} ${item.plate} ${item.provider}`.toLowerCase().includes(query);
    if (!matchesQuery) return false;

    if (isTotalWeek) {
      return item.clearedFromWeek !== true;
    }
    
    // Filter by day (showing all vistorias done on that day)
    const sameDay = item.day === selectedDay;
    return sameDay && item.clearedFromWeek !== true;
  });

  clearSearchButton.hidden = !query;
  installButton.hidden = !deferredPrompt;

  const statsItems = items.filter(item => item.clearedFromWeek !== true);
  const totalValue = statsItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const uniqueDays = new Set(statsItems.map((item) => item.day)).size;

  summaryGrid.innerHTML = `
    <article class="summary-item">
      <strong>${statsItems.length}</strong>
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
      <strong>${statsItems.length ? escapeHtml(statsItems[0].createdAt) : '—'}</strong>
      <span>último registro</span>
    </article>
  `;

  if (!filtered.length) {
    itemList.innerHTML = '<li class="empty">Nenhum registro encontrado.</li>';
    renderReport(filtered);
    return;
  }

  const badgeClasses = {
    'Inicial': 'badge-inicial',
    'Roubo Recuperado': 'badge-roubo',
    'Incêndio': 'badge-incendio',
    'Enchente': 'badge-enchente',
    'Moto': 'badge-moto',
    'Complemento': 'badge-complemento',
    'Pós entrega': 'badge-pos'
  };

  itemList.innerHTML = filtered.map((item) => {
    const badgeClass = badgeClasses[item.type || 'Inicial'] || 'badge-inicial';
    return `
      <li class="item-card compact-item-card">
        <div class="item-main-info">
          <div class="plate-badge compact-plate-badge">
            <span class="plate-badge-text">${escapeHtml(item.plate)}</span>
          </div>
          <div class="item-details">
            <strong class="item-provider">${escapeHtml(item.provider || 'Sem seguradora')}</strong>
            <span class="item-meta">· ${escapeHtml(formatDateString(item.date))}</span>
            <strong class="item-value">· R$ ${escapeHtml(Number(item.value).toFixed(2).replace('.', ','))}</strong>
            <span class="${badgeClass}" style="margin-left: 6px;">
              ${escapeHtml(item.type || 'Inicial')}
            </span>
            ${item.oficinaName ? `<div class="item-meta" style="margin-top: 4px; color: var(--color-slate-700);">Oficina: <strong>${escapeHtml(item.oficinaName)}</strong></div>` : ''}
          </div>
        </div>
        <div class="actions vertical-actions">
          <button class="action-btn" type="button" data-action="share-text" data-id="${item.id}">📱 Compartilhar</button>
          <button class="action-btn" type="button" data-action="copy-text" data-id="${item.id}">📋 Copiar</button>
          <button class="action-btn" type="button" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="action-btn" type="button" data-action="delete" data-id="${item.id}">Excluir</button>
        </div>
      </li>
    `;
  }).join('');

  itemList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id));
  });

  renderReport(filtered);
}

function renderReport(filteredItems) {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const totals = days.map((day) => {
    const itemsForDay = items.filter((item) => item.day === day && item.clearedFromWeek !== true);
    itemsForDay.sort((a, b) => a.id.localeCompare(b.id));

    const platesHtml = itemsForDay.length
      ? itemsForDay.map((item, index) => `<div style="padding: 3px 0; border-bottom: 1px dashed #cbd5e1; font-weight: 500;">${index + 1}. ${escapeHtml(item.plate)}</div>`).join('')
      : '—';
    return {
      day,
      visits: itemsForDay.length,
      platesHtml,
      value: itemsForDay.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
    };
  });

  reportBody.innerHTML = totals.map(({ day, visits, platesHtml, value }) => `
    <tr>
      <td data-label="Dia" style="font-weight: 600;">${escapeHtml(day)}</td>
      <td data-label="Nº Vistorias" style="font-weight: 600;">${visits}</td>
      <td data-label="Vistorias (Placas)" style="word-break: break-word;">${platesHtml}</td>
      <td data-label="Valor Total" style="font-weight: 600; white-space: nowrap;">R$ ${value.toFixed(2).replace('.', ',')}</td>
    </tr>
  `).join('');

  const totalVisits = totals.reduce((sum, d) => sum + d.visits, 0);
  const totalValue = totals.reduce((sum, d) => sum + d.value, 0);
  weeklyVisits.textContent = totalVisits;
  weeklyValue.textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;
}

function getSurveyText(id) {
  const item = items.find(entry => entry.id === id);
  if (!item) return '';

  const dateParts = item.date ? item.date.split('-') : [];
  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : item.date;

  const details = item.details || {};

  // Checklist helper
  const getCheckmark = (val, field) => {
    const isSim = (val || '').toLowerCase() === 'sim';
    if (field === 'motorFunciona') {
      return isSim ? 'Sim(x ) Não(   )' : 'Sim(  ) Não(x   )';
    }
    if (field === 'estepe') {
      return isSim ? 'Sim ( x) Não ( )' : 'Sim ( ) Não ( x)';
    }
    if (field === 'triangulo') {
      return isSim ? 'Sim (x ) Não (   )' : 'Sim ( ) Não ( x )';
    }
    return isSim ? 'Sim (x ) Não ( )' : 'Sim ( ) Não (x )';
  };

  const radioVal = details.radio === 'Original' ? 'original' : (details.radioBrand || 'Outra');

  let sections = [];

  if (item.type === 'Incêndio') {
    sections.push(`Incêndio`);
    sections.push(`${item.plate || ''} - ${item.provider || 'Sem seguradora'} - ${item.oficinaName || 'Sem oficina'}`);
    
    let checklist = [];
    checklist.push(`VISTORIA REALIZADA EM: ${formattedDate}`);
    checklist.push(`REBOCADO?: ${getCheckmark(details.rebocado || 'Não', 'rebocado')}`);
    checklist.push(`MOTOR FUNCIONA?: ${getCheckmark(details.motorFunciona || 'Não', 'motorFunciona')}`);
    checklist.push(`VEICULO COM ESTEPE?: ${getCheckmark(details.estepe || 'Não', 'estepe')}`);
    checklist.push(`MACACO?: ${getCheckmark(details.macaco || 'Não', 'macaco')}`);
    checklist.push(`TRIÂNGULO ?: ${getCheckmark(details.triangulo || 'Não', 'triangulo')}`);
    checklist.push(`CHAVE DE RODA ?: ${getCheckmark(details.chaveRoda || 'Não', 'chaveRoda')}`);
    checklist.push(`RÁDIO / MARCA:${radioVal}`);
    checklist.push(`PARABRISA.: ${(details.parabrisa || 'Bom').toLowerCase()}`);
    checklist.push(`BATERIA / MARCA: ${details.bateria || ''}`);
    sections.push(checklist.join('\n'));

    let fireDetails = [];
    if (details.origemIncendio) fireDetails.push(`Ponto de Origem do Incêndio : ${details.origemIncendio}`);
    if (details.sistemaCombustivel) fireDetails.push(`Avaliação do Sistema de Combustível e Fluidos : ${details.sistemaCombustivel}`);
    if (details.sistemaEletrico) fireDetails.push(`Avaliação do Sistema Elétrico : ${details.sistemaEletrico}`);
    if (details.residuosExtincao) fireDetails.push(`Resíduos de Extinção do Incêndio : ${getCheckmark(details.residuosExtincao || 'Não', 'residuosExtincao')}`);
    if (details.tanqueAfetado) fireDetails.push(`Tanque de combustível foi afetado ?: ${getCheckmark(details.tanqueAfetado || 'Não', 'tanqueAfetado')}`);
    if (fireDetails.length > 0) {
      sections.push(fireDetails.join('\n'));
    }

    if (details.obs) {
      sections.push(`Observações Complementares : ${details.obs}`);
    }
  } else {
    // Other survey types
    sections.push(`${item.plate || ''} - ${item.provider || 'Sem seguradora'} - ${item.oficinaName || 'Sem oficina'}`);
    
    let checklist = [];
    checklist.push(`VISTORIA REALIZADA EM: ${formattedDate}`);
    checklist.push(`REBOCADO?: ${getCheckmark(details.rebocado || 'Não', 'rebocado')}`);
    checklist.push(`MOTOR FUNCIONA?: ${getCheckmark(details.motorFunciona || 'Não', 'motorFunciona')}`);
    
    if ('estepe' in details) {
      checklist.push(`VEICULO COM ESTEPE?: ${getCheckmark(details.estepe || 'Não', 'estepe')}`);
      checklist.push(`MACACO?: ${getCheckmark(details.macaco || 'Não', 'macaco')}`);
      checklist.push(`TRIÂNGULO ?: ${getCheckmark(details.triangulo || 'Não', 'triangulo')}`);
      checklist.push(`CHAVE DE RODA ?: ${getCheckmark(details.chaveRoda || 'Não', 'chaveRoda')}`);
      checklist.push(`RÁDIO / MARCA:${radioVal}`);
      checklist.push(`PARABRISA.: ${(details.parabrisa || 'Bom').toLowerCase()}`);
      checklist.push(`BATERIA / MARCA: ${details.bateria || ''}`);
    }
    sections.push(checklist.join('\n'));

    let typeSpecificDetails = [];
    if (item.type === 'Roubo Recuperado' && details.obsRoubo) {
      typeSpecificDetails.push(`Observações Roubo: ${details.obsRoubo}`);
    }
    if (item.type === 'Enchente') {
      const yesNo = (val) => val === 'Sim' ? 'Sim' : 'Não';
      if (details.aguaOleo) checklist.push(`Vestígios de água no óleo: ${yesNo(details.aguaOleo)}`);
      if (details.aguaVelas) checklist.push(`Vestígios de água nas velas: ${yesNo(details.aguaVelas)}`);
      if (details.aguaFarois) checklist.push(`Vestígios de água nos faróis: ${yesNo(details.aguaFarois)}`);
      if (details.aguaLanternas) checklist.push(`Vestígios de água nas lanternas: ${yesNo(details.aguaLanternas)}`);
      if (details.aguaFiltro) checklist.push(`Vestígios de água no filtro: ${yesNo(details.aguaFiltro)}`);
      if (details.motorTravado) checklist.push(`Motor travado: ${yesNo(details.motorTravado)}`);
      if (details.alturaAgua) checklist.push(`Altura da água: ${details.alturaAgua}`);
    }
    if ((item.type === 'Complemento' || item.type === 'Pós entrega') && details.conteudoLivre) {
      checklist.push(`Conteúdo: ${details.conteudoLivre}`);
    }
    
    sections.push(checklist.join('\n'));

    const obsVal = details.obs || details.obsRoubo || details.obsIncendio || details.obsEnchente || '';
    if (obsVal) {
      sections.push(`Obs.: ${obsVal}`);
    }
  }

  // Universal fields (Trocas & Reparos)
  if (details.trocas) {
    sections.push(`Trocas\n${details.trocas}`);
  } else if (item.type === 'Incêndio') {
    sections.push(`Trocas`);
  }

  if (details.reparos) {
    sections.push(`Reparos\n${details.reparos}`);
  } else if (item.type === 'Incêndio') {
    sections.push(`Reparos`);
  }

  return sections.join('\n\n');
}

function shareSurveyText(id) {
  const text = getSurveyText(id);
  if (!text) return;

  if (navigator.share) {
    navigator.share({
      title: 'Compartilhamento de Vistoria',
      text: text
    }).catch(err => {
      if (err.name === 'AbortError') return;
      console.warn('Erro ao compartilhar pelo Web Share API, copiando para a área de transferência...', err);
      copyTextToClipboard(text);
    });
  } else {
    copyTextToClipboard(text);
  }
}

function copySurveyText(id) {
  const text = getSurveyText(id);
  if (!text) return;
  copyTextToClipboard(text);
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function handleAction(action, id) {
  if (action === 'share-text') {
    shareSurveyText(id);
    return;
  }
  if (action === 'copy-text') {
    copySurveyText(id);
    return;
  }
  if (action === 'delete') {
    if (window.confirm('Deseja excluir este registro de vistoria?')) {
      items = items.filter((item) => item.id !== id);
      saveItems();
      render();
    }
    return;
  }

  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  editingId = item.id;
  plateInput.value = item.plate || '';
  providerSelect.value = item.providerId || '';
  valueInput.value = item.value || '';
  
  selectedType = item.type || 'Inicial';
  if (typeInput) typeInput.value = selectedType;
  
  if (vistoriaTypeTabs) {
    vistoriaTypeTabs.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.type === selectedType);
    });
  }
  
  const formTitle = document.getElementById('formTitle');
  if (formTitle) {
    formTitle.textContent = `Editar registro - ${selectedType}`;
  }
  
  // Render dynamic fields before populating them
  renderDynamicSurveyFields();

  if (item.oficinaId) {
    const oficinaSelect = document.getElementById('itemOficinaSelect');
    if (oficinaSelect) oficinaSelect.value = item.oficinaId;
  }

  if (item.details) {
    Object.keys(item.details).forEach((key) => {
      const input = dynamicFieldsContainer.querySelector(`[name="${key}"]`);
      if (input) {
        input.value = item.details[key];
        
        const container = input.closest('.type-buttons-container');
        if (container) {
          container.querySelectorAll('.type-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.value === item.details[key]);
          });
        }
        
        if (key === 'radio') {
          const brandInput = document.getElementById('input_radio_brand');
          if (brandInput) {
            brandInput.style.display = item.details[key] === 'Outra' ? 'block' : 'none';
            brandInput.required = item.details[key] === 'Outra';
          }
        }
      }
    });
  }

  updateTypeButtonsHighlight();
  updateInsurerButtonsHighlight();
  updateFormState();
  plateInput.focus();
}

function updateDayTabs() {
  dayTabs.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.day === selectedDay);
  });
  updateFormDisplay();
}

function updatePageTitleHeader() {
  const elem = document.getElementById('currentPageTitle');
  if (!elem) return;
  let titleText = `${selectedDay}-feira`;
  if (selectedDay === 'Seguradoras') titleText = 'Seguradoras';
  else if (selectedDay === 'Oficinas') titleText = 'Oficinas';
  else if (selectedDay === 'Total da semana') titleText = 'Total da Semana';
  else if (selectedDay === 'Mês vigente') titleText = 'Mês Vigente';
  else if (selectedDay === 'Supervisão') titleText = 'Supervisão';

  elem.innerHTML = titleText;
  elem.textContent = titleText;
}

function updateFormDisplay() {
  const currentDate = new Date();
  const dateValue = getTodayDateValue();
  const currentDay = getSelectedSaveDay();
  const isInsurerPane = selectedDay === 'Seguradoras';
  const isOficinaPane = selectedDay === 'Oficinas';

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

  updatePageTitleHeader();

  if (formTitle) {
    if (isInsurerPane) {
      formTitle.textContent = 'Cadastre seguradoras';
    } else if (isOficinaPane) {
      formTitle.textContent = 'Cadastre oficinas';
    } else {
      formTitle.textContent = `Novo registro - ${selectedType}`;
    }
  }
  
  if (insurerForm) insurerForm.hidden = selectedDay !== 'Seguradoras';
  if (insurerCard) insurerCard.hidden = selectedDay !== 'Seguradoras';
  if (noInsurersNote) noInsurersNote.hidden = selectedDay !== 'Seguradoras';
  
  if (oficinaForm) oficinaForm.hidden = selectedDay !== 'Oficinas';
  if (oficinaCard) oficinaCard.hidden = selectedDay !== 'Oficinas';

  const isWeekday = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].includes(selectedDay);
  if (formCard) formCard.hidden = !isWeekday;
  if (recordsCard) recordsCard.hidden = !isWeekday && selectedDay !== 'Mês vigente';
  if (reportCard) reportCard.hidden = selectedDay !== 'Total da semana';
  
  if (vistoriaTypeTabsCard) {
    vistoriaTypeTabsCard.style.display = isWeekday ? 'block' : 'none';
  }
  
  if (supervisaoFormCard) supervisaoFormCard.hidden = selectedDay !== 'Supervisão';
  if (supervisaoRecordsCard) supervisaoRecordsCard.hidden = selectedDay !== 'Supervisão';

  if (clearWeekButton && clearMonthButton) {
    if (selectedDay === 'Mês vigente') {
      clearWeekButton.style.display = 'none';
      clearMonthButton.style.display = 'inline-block';
    } else if (['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Total da semana'].includes(selectedDay)) {
      clearWeekButton.style.display = 'inline-block';
      clearMonthButton.style.display = 'none';
    } else {
      clearWeekButton.style.display = 'none';
      clearMonthButton.style.display = 'none';
    }
  }

  if (isWeekday) {
    renderDynamicSurveyFields();
  }

  if (selectedDay === 'Supervisão') {
    populateSupervisaoOficinaSelect();
    populateSupervisaoOficinaFilter();
    renderSupervisaoReport();
  }

  populateProviderSelect();
  updateInsurerButtonsHighlight();
}

function populateProviderSelect() {
  if (!insurerButtonsContainer) return;

  insurerButtonsContainer.innerHTML = '';
  if (!insurers.length) {
    noInsurersNote.hidden = false;
    if (providerSelect) providerSelect.value = '';
    return;
  }

  noInsurersNote.hidden = true;

  insurers.forEach((insurer) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'insurer-btn';
    btn.dataset.id = insurer.id;
    btn.textContent = insurer.name;
    btn.addEventListener('click', () => {
      selectInsurer(insurer);
    });
    insurerButtonsContainer.appendChild(btn);
  });
}

function selectInsurer(insurer) {
  if (providerSelect) {
    providerSelect.value = insurer.id;
  }
  if (valueInput) {
    valueInput.value = insurer.price.toFixed(2);
  }
  updateInsurerButtonsHighlight();
}

function updateInsurerButtonsHighlight() {
  if (!insurerButtonsContainer || !providerSelect) return;
  const selectedId = providerSelect.value;
  insurerButtonsContainer.querySelectorAll('.insurer-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.id === selectedId);
  });
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

function loadOficinas() {
  const raw = localStorage.getItem('web-system-oficinas-v1');
  return raw ? safeParseJson(raw, []) : [];
}

function saveOficinas() {
  localStorage.setItem('web-system-oficinas-v1', JSON.stringify(oficinas));
}

function saveOficina(event) {
  event.preventDefault();

  const name = oficinaNameInput.value.trim();
  if (!name) return;

  if (editingOficinaId) {
    oficinas = oficinas.map((oficina) => oficina.id === editingOficinaId ? { ...oficina, name } : oficina);
  } else {
    oficinas.push({
      id: Date.now().toString(),
      name
    });
  }

  saveOficinas();
  oficinaForm.reset();
  editingOficinaId = null;
  cancelOficinaEditButton.hidden = true;
  renderOficinas();
  
  if (selectedDay === 'Supervisão') {
    populateSupervisaoOficinaSelect();
    populateSupervisaoOficinaFilter();
  }
  
  selectedDay = 'Oficinas';
  updateDayTabs();
}

function cancelOficinaEdit() {
  editingOficinaId = null;
  oficinaForm.reset();
  cancelOficinaEditButton.hidden = true;
}

function renderOficinas() {
  if (!oficinaList) return;

  oficinaList.innerHTML = oficinas.length
    ? oficinas.map((oficina) => `
      <li class="item-card">
        <header>
          <div>
            <strong>${escapeHtml(oficina.name)}</strong>
          </div>
          <div class="actions">
            <button class="action-btn" type="button" data-action="edit-oficina" data-id="${oficina.id}">Editar</button>
            <button class="action-btn" type="button" data-action="delete-oficina" data-id="${oficina.id}">Excluir</button>
          </div>
        </header>
      </li>
    `).join('')
    : '<li class="empty">Nenhuma oficina cadastrada.</li>';

  oficinaList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleOficinaAction(button.dataset.action, button.dataset.id));
  });
}

function handleOficinaAction(action, id) {
  if (action === 'delete-oficina') {
    if (window.confirm('Deseja excluir esta oficina?')) {
      oficinas = oficinas.filter((oficina) => oficina.id !== id);
      saveOficinas();
      renderOficinas();
    }
    return;
  }

  const oficina = oficinas.find((entry) => entry.id === id);
  if (!oficina) return;

  editingOficinaId = oficina.id;
  oficinaNameInput.value = oficina.name;
  cancelOficinaEditButton.hidden = false;
  oficinaNameInput.focus();
}

function renderDynamicSurveyFields() {
  if (!dynamicFieldsContainer) return;

  const officeOptions = oficinas.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
  const officeDropdownHtml = `
    <label style="width: 100%; max-width: 100%; box-sizing: border-box;">
      Oficina
      <select id="itemOficinaSelect" name="oficinaId" required>
        <option value="" disabled selected>${oficinas.length ? 'Selecione a oficina...' : 'Nenhuma oficina cadastrada'}</option>
        ${officeOptions}
      </select>
      ${!oficinas.length ? '<span style="color:#ef4444; font-size:0.75rem; margin-top:4px; display:block;">Cadastre uma oficina no menu antes de prosseguir.</span>' : ''}
    </label>
  `;

  let fieldsHtml = '';

  const commonChecklistHtml = `
    <div class="form-toggle-field">
      <span class="status-label">Rebocado?</span>
      <div class="type-buttons-container" data-input-id="input_rebocado">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
      </div>
      <input type="hidden" id="input_rebocado" name="rebocado" value="Não" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Motor funciona?</span>
      <div class="type-buttons-container" data-input-id="input_motor">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
      </div>
      <input type="hidden" id="input_motor" name="motorFunciona" value="Não" />
    </div>
  `;

  const vehicleExtraChecklistHtml = `
    <div class="form-toggle-field">
      <span class="status-label">Veículo com estepe?</span>
      <div class="type-buttons-container" data-input-id="input_estepe">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
      </div>
      <input type="hidden" id="input_estepe" name="estepe" value="Não" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Macaco?</span>
      <div class="type-buttons-container" data-input-id="input_macaco">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
      </div>
      <input type="hidden" id="input_macaco" name="macaco" value="Não" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Triângulo?</span>
      <div class="type-buttons-container" data-input-id="input_triangulo">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
      </div>
      <input type="hidden" id="input_triangulo" name="triangulo" value="Não" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Chave de roda?</span>
      <div class="type-buttons-container" data-input-id="input_chave">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
      </div>
      <input type="hidden" id="input_chave" name="chaveRoda" value="Não" />
    </div>

    <div class="form-toggle-field" style="grid-column: 1 / -1;">
      <span class="status-label">Rádio / Marca</span>
      <div class="type-buttons-container radio-toggle" data-input-id="input_radio" style="margin-bottom: 8px;">
        <button type="button" class="type-btn active" data-value="Original">Original</button>
        <button type="button" class="type-btn" data-value="Outra">Outra</button>
      </div>
      <input type="hidden" id="input_radio" name="radio" value="Original" />
      <input type="text" id="input_radio_brand" name="radioBrand" placeholder="Digite a marca do rádio" style="display: none;" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Parabrisa</span>
      <div class="type-buttons-container" data-input-id="input_parabrisa">
        <button type="button" class="type-btn active" data-value="Bom">Bom</button>
        <button type="button" class="type-btn" data-value="Ruim">Ruim</button>
      </div>
      <input type="hidden" id="input_parabrisa" name="parabrisa" value="Bom" />
    </div>

    <label>
      Bateria / Marca
      <input type="text" name="bateria" placeholder="Marca da bateria" />
    </label>
  `;

  const obsHtml = `
    <label style="grid-column: 1 / -1;">
      Observações (Obs.)
      <input type="text" name="obs" placeholder="Ex: tinta tricoat" />
    </label>
  `;

  const trocasReparosHtml = `
    <label style="grid-column: 1 / -1;">
      Trocas (uma peça por linha)
      <textarea name="trocas" rows="3" placeholder="Ex:&#10;Lateral LE&#10;Porta traseira LE"></textarea>
    </label>
    <label style="grid-column: 1 / -1;">
      Reparos (uma peça por linha)
      <textarea name="reparos" rows="3" placeholder="Ex:&#10;Coluna LE do teto&#10;Caixa de ar LE"></textarea>
    </label>
  `;

  const extraFieldsHtml = obsHtml + trocasReparosHtml;

  if (selectedType === 'Inicial') {
    fieldsHtml = commonChecklistHtml + vehicleExtraChecklistHtml + extraFieldsHtml;
  } else if (selectedType === 'Moto') {
    fieldsHtml = commonChecklistHtml + extraFieldsHtml;
  } else if (selectedType === 'Roubo Recuperado') {
    fieldsHtml = commonChecklistHtml + vehicleExtraChecklistHtml + extraFieldsHtml;
  } else if (selectedType === 'Incêndio') {
    fieldsHtml = commonChecklistHtml + vehicleExtraChecklistHtml + obsHtml + `
      <label style="grid-column: 1 / -1;">
        Ponto de Origem do Incêndio
        <input type="text" name="origemIncendio" placeholder="Ex: Compartimento do motor" />
      </label>
      
      <div class="form-toggle-field" style="grid-column: 1 / -1;">
        <span class="status-label">Avaliação do Sistema de Combustível e Fluidos</span>
        <div class="type-buttons-container" data-input-id="input_sistema_combustivel">
          <button type="button" class="type-btn active" data-value="Ok">Ok</button>
          <button type="button" class="type-btn" data-value="Parcialmente Avariado">Parcialmente Avariado</button>
          <button type="button" class="type-btn" data-value="Totalmente Avariado">Totalmente Avariado</button>
        </div>
        <input type="hidden" id="input_sistema_combustivel" name="sistemaCombustivel" value="Ok" />
      </div>

      <div class="form-toggle-field" style="grid-column: 1 / -1;">
        <span class="status-label">Avaliação do Sistema Elétrico</span>
        <div class="type-buttons-container" data-input-id="input_sistema_eletrico">
          <button type="button" class="type-btn active" data-value="Ok">Ok</button>
          <button type="button" class="type-btn" data-value="Parcialmente Avariado">Parcialmente Avariado</button>
          <button type="button" class="type-btn" data-value="Totalmente Avariado">Totalmente Avariado</button>
        </div>
        <input type="hidden" id="input_sistema_eletrico" name="sistemaEletrico" value="Ok" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Resíduos de Extinção do Incêndio?</span>
        <div class="type-buttons-container" data-input-id="input_residuos">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
        </div>
        <input type="hidden" id="input_residuos" name="residuosExtincao" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Tanque de combustível foi afetado?</span>
        <div class="type-buttons-container" data-input-id="input_tanque">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
        </div>
        <input type="hidden" id="input_tanque" name="tanqueAfetado" value="Não" />
      </div>
    ` + trocasReparosHtml;
  } else if (selectedType === 'Enchente') {
    fieldsHtml = commonChecklistHtml + vehicleExtraChecklistHtml + `
      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água no óleo do motor?</span>
        <div class="type-buttons-container" data-input-id="input_oleo">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
        </div>
        <input type="hidden" id="input_oleo" name="aguaOleo" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água nas velas?</span>
        <div class="type-buttons-container" data-input-id="input_velas">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
        </div>
        <input type="hidden" id="input_velas" name="aguaVelas" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água nos faróis?</span>
        <div class="type-buttons-container" data-input-id="input_farois">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
        </div>
        <input type="hidden" id="input_farois" name="aguaFarois" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água nas lanternas?</span>
        <div class="type-buttons-container" data-input-id="input_lanternas">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
        </div>
        <input type="hidden" id="input_lanternas" name="aguaLanternas" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água no filtro?</span>
        <div class="type-buttons-container" data-input-id="input_filtro">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
        </div>
        <input type="hidden" id="input_filtro" name="aguaFiltro" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Motor travado?</span>
        <div class="type-buttons-container" data-input-id="input_travado">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
        </div>
        <input type="hidden" id="input_travado" name="motorTravado" value="Não" />
      </div>

      <label>
        Altura da água
        <input type="text" name="alturaAgua" placeholder="Ex: Acima dos bancos" />
      </label>
    ` + extraFieldsHtml;
  } else if (selectedType === 'Complemento' || selectedType === 'Pós entrega') {
    fieldsHtml = `
      <label style="grid-column: 1 / -1;">
        Conteúdo do Relatório
        <textarea name="conteudoLivre" rows="5" required placeholder="Digite o conteúdo livre para o relatório..."></textarea>
      </label>
    ` + extraFieldsHtml;
  }

  dynamicFieldsContainer.innerHTML = officeDropdownHtml + fieldsHtml;

  // Bind events for dynamic elements
  dynamicFieldsContainer.querySelectorAll('.type-buttons-container .type-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const container = btn.closest('.type-buttons-container');
      const inputId = container.dataset.inputId;
      const input = document.getElementById(inputId);
      const value = btn.dataset.value;

      if (input) input.value = value;

      container.querySelectorAll('.type-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.value === value);
      });

      if (container.classList.contains('radio-toggle')) {
        const brandInput = document.getElementById('input_radio_brand');
        if (brandInput) {
          brandInput.style.display = value === 'Outra' ? 'block' : 'none';
          brandInput.required = value === 'Outra';
        }
      }
    });
  });
}

function populateSupervisaoOficinaSelect() {
  if (!supervisaoOficinaSelect) return;
  const currentVal = supervisaoOficinaSelect.value;
  const options = oficinas.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
  supervisaoOficinaSelect.innerHTML = `<option value="" disabled selected>${oficinas.length ? 'Selecione a oficina...' : 'Nenhuma oficina cadastrada'}</option>` + options;
  if (currentVal && oficinas.some(o => o.id === currentVal)) {
    supervisaoOficinaSelect.value = currentVal;
  }
}

function populateSupervisaoOficinaFilter() {
  if (!supervisaoOficinaFilterContainer) return;
  
  let buttonsHtml = `<button type="button" class="type-btn${selectedSupervisaoOficina === 'Todas' ? ' active' : ''}" data-filter-oficina="Todas">Todas</button>`;
  oficinas.forEach((oficina) => {
    buttonsHtml += `<button type="button" class="type-btn${selectedSupervisaoOficina === oficina.id ? ' active' : ''}" data-filter-oficina="${oficina.id}">${escapeHtml(oficina.name)}</button>`;
  });
  
  supervisaoOficinaFilterContainer.innerHTML = buttonsHtml;
}

function generateWeeklyReportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235); // #2563eb
  doc.text("Gestão de Vistoria Inicial", pageWidth / 2, 20, { align: "center" });

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(75, 93, 118); // #4b5d76
  const todayStr = new Date().toLocaleDateString('pt-BR');
  doc.text(`Relatório Semanal - Gerado em ${todayStr}`, pageWidth / 2, 28, { align: "center" });

  // Draw line
  doc.setDrawColor(215, 226, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 34, pageWidth - 14, 34);

  // Statistics
  const activeWeeklyItems = items.filter(item => item.clearedFromWeek !== true);
  const totalVisitsCount = activeWeeklyItems.length;
  const totalValueSum = activeWeeklyItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 37, 66);
  doc.text(`Total de Vistorias na Semana: ${totalVisitsCount}`, 14, 42);
  doc.text(`Valor Total Geral: R$ ${totalValueSum.toFixed(2).replace('.', ',')}`, 14, 48);

  // Prepare table data
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const tableRows = days.map((day) => {
    const itemsForDay = activeWeeklyItems.filter((item) => item.day === day);
    const visits = itemsForDay.length;
    const plates = itemsForDay.map((item) => item.plate).join(', ');
    const value = itemsForDay.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    return [
      `${day}-feira`,
      visits.toString(),
      plates || '—',
      `R$ ${value.toFixed(2).replace('.', ',')}`
    ];
  });

  const displayedVisits = activeWeeklyItems.filter(item => days.includes(item.day)).length;
  const displayedValue = activeWeeklyItems.filter(item => days.includes(item.day)).reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  // Add Totals row
  tableRows.push([
    'Totais',
    displayedVisits.toString(),
    '—',
    `R$ ${displayedValue.toFixed(2).replace('.', ',')}`
  ]);

  // Generate Table using jsPDF-AutoTable
  doc.autoTable({
    startY: 55,
    head: [['Dia', 'Vistorias', 'Placas Vistoriadas', 'Total Valor']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [16, 37, 66],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 95 },
      3: { cellWidth: 35, halign: 'right' }
    },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 4
    },
    didParseCell: function (data) {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [226, 232, 240];
      }
    }
  });

  const filename = `relatorio_semanal_${new Date().toISOString().slice(0, 10)}.pdf`;
  try {
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file],
        title: 'Relatório Semanal de Vistorias',
        text: 'Segue em anexo o relatório semanal de vistorias.'
      }).catch(err => {
        console.warn('Erro ao abrir diálogo de compartilhamento:', err);
        doc.save(filename);
      });
    } else {
      doc.save(filename);
    }
  } catch (error) {
    console.error('Falha ao compartilhar PDF, executando download direto:', error);
    doc.save(filename);
  }
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

function formatDateString(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
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

function updateTypeButtonsHighlight() {
  // No-op (type is managed by sub-tabs)
}

function loadSupervisoes() {
  const raw = localStorage.getItem('web-system-supervisoes-v1');
  return raw ? safeParseJson(raw, []) : [];
}

function saveSupervisoes() {
  localStorage.setItem('web-system-supervisoes-v1', JSON.stringify(supervisoes));
}

function saveSupervisao(event) {
  event.preventDefault();

  const vehicle = supervisaoVehicleInput.value.trim();
  const plate = vehicle; // unified vehicle & plate
  const attended = supervisaoAttendedInput.value.trim();
  const stage = supervisaoStageInput.value;
  const partsPending = supervisaoPartsPendingInput.value;
  const parts = partsPending === 'Sim' ? supervisaoPartsInput.value.trim() : '';
  const arrival = partsPending === 'Sim' ? supervisaoArrivalInput.value.trim() : '';
  const other = supervisaoOtherInput.value.trim();
  const finish = supervisaoFinishInput.value.trim();

  // Read oficina
  const oficinaId = supervisaoOficinaSelect.value;
  const selectedOficina = oficinas.find(o => o.id === oficinaId);
  const oficinaName = selectedOficina ? selectedOficina.name : '';

  if (!vehicle || !attended || !stage || !oficinaId) {
    alert('Por favor, preencha todos os campos obrigatórios.');
    return;
  }

  if (editingSupervisaoId) {
    supervisoes = supervisoes.map((s) => s.id === editingSupervisaoId ? { 
      ...s, vehicle, plate, attended, stage, partsPending, parts, arrival, other, finish, oficinaId, oficinaName 
    } : s);
  } else {
    supervisoes.unshift({
      id: Date.now().toString(),
      date: getTodayDateValue(),
      day: getWeekdayName(new Date()),
      vehicle,
      plate,
      attended,
      stage,
      partsPending,
      parts,
      arrival,
      other,
      finish,
      oficinaId,
      oficinaName,
      createdAt: new Date().toLocaleString('pt-BR')
    });
  }

  saveSupervisoes();
  supervisaoForm.reset();
  if (supervisaoPartsPendingInput) supervisaoPartsPendingInput.value = 'Não';
  if (supervisaoPartsPendingButtons) {
    supervisaoPartsPendingButtons.querySelectorAll('.type-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.value === 'Não');
    });
  }
  if (supervisaoPartsDetailsContainer) supervisaoPartsDetailsContainer.style.display = 'none';
  
  editingSupervisaoId = null;
  if (cancelSupervisaoEditButton) cancelSupervisaoEditButton.hidden = true;
  if (saveSupervisaoButton) saveSupervisaoButton.textContent = 'Salvar';
  
  renderSupervisaoReport();
  render();
}

function cancelSupervisaoEdit() {
  editingSupervisaoId = null;
  supervisaoForm.reset();
  if (supervisaoPartsPendingInput) supervisaoPartsPendingInput.value = 'Não';
  if (supervisaoPartsPendingButtons) {
    supervisaoPartsPendingButtons.querySelectorAll('.type-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.value === 'Não');
    });
  }
  if (supervisaoPartsDetailsContainer) supervisaoPartsDetailsContainer.style.display = 'none';
  if (cancelSupervisaoEditButton) cancelSupervisaoEditButton.hidden = true;
  if (saveSupervisaoButton) saveSupervisaoButton.textContent = 'Salvar';
}

function renderSupervisaoReport() {
  if (!supervisaoReportContent) return;

  const filtered = supervisoes.filter((s) => {
    if (selectedSupervisaoStage !== 'Todos' && s.stage !== selectedSupervisaoStage) return false;
    if (selectedSupervisaoOficina !== 'Todas' && s.oficinaId !== selectedSupervisaoOficina) return false;
    return true;
  });

  if (!filtered.length) {
    supervisaoReportContent.innerHTML = '<tr><td colspan="7" class="empty">Nenhum registro de supervisão encontrado.</td></tr>';
    return;
  }

  // Sort by created time descending
  filtered.sort((a, b) => b.id.localeCompare(a.id));

  supervisaoReportContent.innerHTML = filtered.map((s) => {
    let partsPendingHtml = '';
    if (s.partsPending === 'Sim') {
      partsPendingHtml = `<span class="badge-roubo">Sim: ${escapeHtml(s.parts || '—')}</span>`;
    } else {
      partsPendingHtml = `<span class="badge-pos">Não</span>`;
    }

    const stageClasses = {
      'Aguardando peças fora de serviço': 'badge-roubo',
      'Em posse do proprietário': 'badge-inicial',
      'Em lanternagem': 'badge-incendio',
      'Em funilaria': 'badge-incendio',
      'Em preparação de pintura': 'badge-enchente',
      'Em pintura': 'badge-enchente',
      'Em montagem': 'badge-moto',
      'Testes finais': 'badge-moto',
      'Finalizado e entregue': 'badge-pos',
      'Finalizado': 'badge-pos'
    };
    const stageClass = stageClasses[s.stage] || 'badge-inicial';

    let prevEst = `Finalização: ${escapeHtml(s.finish || '—')}`;
    if (s.partsPending === 'Sim') {
      prevEst += `<br><small style="color:#6b7280;">Peças: ${escapeHtml(s.arrival || '—')}</small>`;
    }

    return `
      <tr>
        <td data-label="Veículo" style="font-weight: 600;">${escapeHtml(s.vehicle)}</td>
        <td data-label="Oficina" style="font-weight: 500;">${escapeHtml(s.oficinaName || 'Sem oficina')}</td>
        <td data-label="Atendido por">${escapeHtml(s.attended)}</td>
        <td data-label="Status">
          <span class="${stageClass}">${escapeHtml(s.stage)}</span>
        </td>
        <td data-label="Pendência Peças">${partsPendingHtml}</td>
        <td data-label="Previsão/Estimativa">${prevEst}</td>
        <td data-label="Ações">
          <div class="actions">
            <button class="action-btn" type="button" data-super-action="share-text" data-id="${s.id}" title="Compartilhar texto">📱 Compartilhar</button>
            <button class="action-btn" type="button" data-super-action="copy-text" data-id="${s.id}" title="Copiar texto">📋 Copiar</button>
            <button class="action-btn" type="button" data-super-action="edit" data-id="${s.id}">Editar</button>
            <button class="action-btn" type="button" data-super-action="delete" data-id="${s.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  supervisaoReportContent.querySelectorAll('[data-super-action]').forEach((button) => {
    button.addEventListener('click', () => handleSupervisaoAction(button.dataset.superAction, button.dataset.id));
  });
}

function handleSupervisaoAction(action, id) {
  if (action === 'delete') {
    if (window.confirm('Deseja excluir este registro de supervisão?')) {
      supervisoes = supervisoes.filter((s) => s.id !== id);
      saveSupervisoes();
      renderSupervisaoReport();
      render();
    }
    return;
  }

  const s = supervisoes.find((entry) => entry.id === id);
  if (!s) return;

  if (action === 'share-text') {
    const text = formatSingleSupervisaoText(s);
    shareSupervisaoText(text, `Supervisão - ${s.vehicle || ''}`);
    return;
  }

  if (action === 'copy-text') {
    const text = formatSingleSupervisaoText(s);
    copySupervisaoTextToClipboard(text);
    return;
  }

  editingSupervisaoId = s.id;
  supervisaoVehicleInput.value = s.vehicle || '';
  if (supervisaoOficinaSelect) supervisaoOficinaSelect.value = s.oficinaId || '';
  supervisaoAttendedInput.value = s.attended || '';
  supervisaoStageInput.value = s.stage || '';
  
  const pending = s.partsPending || 'Não';
  if (supervisaoPartsPendingInput) supervisaoPartsPendingInput.value = pending;
  if (supervisaoPartsPendingButtons) {
    supervisaoPartsPendingButtons.querySelectorAll('.type-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.value === pending);
    });
  }

  if (supervisaoPartsDetailsContainer) {
    supervisaoPartsDetailsContainer.style.display = pending === 'Sim' ? 'block' : 'none';
  }
  supervisaoPartsInput.value = s.parts || '';
  supervisaoArrivalInput.value = s.arrival || '';
  supervisaoOtherInput.value = s.other || '';
  supervisaoFinishInput.value = s.finish || '';

  if (cancelSupervisaoEditButton) cancelSupervisaoEditButton.hidden = false;
  if (saveSupervisaoButton) saveSupervisaoButton.textContent = 'Atualizar';
  
  supervisaoVehicleInput.focus();
}

function formatSingleSupervisaoText(s) {
  let sections = ['Supervisão'];

  if (s.vehicle && s.vehicle.trim()) {
    sections.push(`Veículo: ${s.vehicle.trim()}`);
  }

  let details = [];

  const dateVal = s.date || getTodayDateValue();
  if (dateVal && dateVal.trim()) {
    details.push(`Data: ${formatDateString(dateVal.trim())}`);
  }

  if (s.oficinaName && s.oficinaName.trim()) {
    details.push(`Oficina: ${s.oficinaName.trim()}`);
  }

  if (s.attended && s.attended.trim()) {
    details.push(`Atendido por : ${s.attended.trim()}`);
  }

  if (s.stage && s.stage.trim()) {
    details.push(`Em que parte do serviço esta?: ${s.stage.trim()}`);
  }

  if (s.partsPending && s.partsPending.trim()) {
    const isPending = s.partsPending === 'Sim';
    const partsPendingText = isPending ? '( X ) sim  (   ) não' : '(   ) sim  ( X ) não';
    details.push(`Pendências de peças?: ${partsPendingText}`);

    if (isPending) {
      if (s.parts && s.parts.trim()) {
        details.push(`Quais?: ${s.parts.trim()}`);
      }
      if (s.arrival && s.arrival.trim()) {
        details.push(`Previsão de chegada?: ${s.arrival.trim()}`);
      }
    }
  }

  if (s.other && s.other.trim()) {
    details.push(`Alguma outra pendência?: ${s.other.trim()}`);
  }

  if (s.finish && s.finish.trim()) {
    details.push(`Estimativa de finalização do veículo?: ${s.finish.trim()}`);
  }

  if (details.length > 0) {
    sections.push(details.join('\n'));
  }

  return sections.join('\n\n');
}

function getFilteredSupervisoes() {
  return supervisoes.filter((s) => {
    if (selectedSupervisaoStage !== 'Todos' && s.stage !== selectedSupervisaoStage) return false;
    if (selectedSupervisaoOficina !== 'Todas' && s.oficinaId !== selectedSupervisaoOficina) return false;
    return true;
  });
}

function formatAllSupervisoesText(filteredList) {
  if (!filteredList || filteredList.length === 0) {
    return 'Nenhum registro de supervisão encontrado.';
  }
  return filteredList.map((s) => formatSingleSupervisaoText(s)).join('\n\n----------------------------------------\n\n');
}

async function shareSupervisaoText(text, title = 'Relatório de Supervisão') {
  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: text
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Erro ao compartilhar via navigator.share:', err);
    }
  }
  copySupervisaoTextToClipboard(text);
}

function copySupervisaoTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } catch (e) {
    console.warn('Não foi possível copiar o texto:', e);
  }
  document.body.removeChild(textarea);
}

function generateSupervisaoReportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235); // #2563eb
  doc.text("Gestão de Vistoria - Relatório de Supervisão", pageWidth / 2, 20, { align: "center" });

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(75, 93, 118); // #4b5d76
  const todayStr = new Date().toLocaleDateString('pt-BR');
  doc.text(`Gerado em ${todayStr} | Status: ${selectedSupervisaoStage} | Oficina: ${selectedSupervisaoOficina === 'Todas' ? 'Todas' : (oficinas.find(o => o.id === selectedSupervisaoOficina)?.name || '')}`, pageWidth / 2, 28, { align: "center" });

  // Draw line
  doc.setDrawColor(215, 226, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 34, pageWidth - 14, 34);

  // Filter items
  const filtered = supervisoes.filter((s) => {
    if (selectedSupervisaoStage !== 'Todos' && s.stage !== selectedSupervisaoStage) return false;
    if (selectedSupervisaoOficina !== 'Todas' && s.oficinaId !== selectedSupervisaoOficina) return false;
    return true;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 37, 66);
  doc.text(`Total de Veículos em Supervisão: ${filtered.length}`, 14, 42);

  // Prepare table data
  const tableRows = filtered.map((s) => {
    let pendingPartsText = s.partsPending === 'Sim' ? `Sim: ${s.parts || '—'}` : 'Não';
    let prevEstText = `Finalização: ${s.finish || '—'}`;
    if (s.partsPending === 'Sim') {
      prevEstText += `\nChegada Peças: ${s.arrival || '—'}`;
    }
    return [
      s.vehicle,
      s.oficinaName || 'Sem oficina',
      s.attended,
      s.stage,
      pendingPartsText,
      prevEstText,
      s.other || '—'
    ];
  });

  // Generate Table using jsPDF-AutoTable
  doc.autoTable({
    startY: 48,
    head: [['Veículo', 'Oficina', 'Atendido por', 'Status', 'Pendência Peças', 'Previsão/Estimativa', 'Outras Pendências']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 4
    }
  });

  const filename = `relatorio_supervisao_${new Date().toISOString().slice(0, 10)}.pdf`;
  try {
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file],
        title: 'Relatório de Supervisão de Vistorias',
        text: 'Segue em anexo o relatório de supervisão.'
      }).catch(err => {
        console.warn('Erro ao abrir diálogo de compartilhamento:', err);
        doc.save(filename);
      });
    } else {
      doc.save(filename);
    }
  } catch (error) {
    console.error('Falha ao compartilhar PDF, executando download direto:', error);
    doc.save(filename);
  }
}

function generateWeeklyReportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('portrait');

  const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text("Gestão de Vistoria - Relatório Semanal", pageWidth / 2, 20, { align: "center" });

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(75, 93, 118);
  const todayStr = new Date().toLocaleDateString('pt-BR');
  doc.text(`Gerado em ${todayStr}`, pageWidth / 2, 27, { align: "center" });

  // Line
  doc.setDrawColor(215, 226, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 32, pageWidth - 14, 32);

  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  
  let grandTotalVisits = 0;
  let grandTotalValue = 0;

  const tableRows = days.map((day) => {
    // Get items for this day
    const itemsForDay = items.filter((item) => item.day === day && item.clearedFromWeek !== true);
    
    // Sort in ascending order by id/creation time
    itemsForDay.sort((a, b) => a.id.localeCompare(b.id));

    grandTotalVisits += itemsForDay.length;
    const dayValue = itemsForDay.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    grandTotalValue += dayValue;

    // Format vistorias on numbered lines in ascending order: "1. ABC-1234", "2. DEF-5678", ...
    let numberedPlatesText = '—';
    if (itemsForDay.length > 0) {
      numberedPlatesText = itemsForDay.map((item, index) => `${index + 1}. ${item.plate}${item.type ? ` (${item.type})` : ''}`).join('\n');
    }

    return [
      `${day}-feira`,
      itemsForDay.length.toString(),
      numberedPlatesText,
      `R$ ${dayValue.toFixed(2).replace('.', ',')}`
    ];
  });

  // Add Totals row
  tableRows.push([
    'Totais',
    grandTotalVisits.toString(),
    '—',
    `R$ ${grandTotalValue.toFixed(2).replace('.', ',')}`
  ]);

  // Generate Table using jsPDF-AutoTable
  doc.autoTable({
    startY: 38,
    head: [['Dia', 'Vistorias', 'Placas (Ordenadas)', 'Total Valor']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: 5
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { halign: 'center', cellWidth: 25 },
      2: { cellWidth: 'auto' },
      3: { fontStyle: 'bold', halign: 'right', cellWidth: 35 }
    }
  });

  const filename = `relatorio_semanal_${new Date().toISOString().slice(0, 10)}.pdf`;
  try {
    const pdfBlob = doc.output('blob');
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file],
        title: 'Relatório Semanal de Vistorias',
        text: 'Segue em anexo o relatório semanal de vistorias em PDF.'
      }).catch(err => {
        if (err.name === 'AbortError') return;
        console.warn('Erro ao abrir diálogo de compartilhamento:', err);
        doc.save(filename);
      });
    } else {
      doc.save(filename);
    }
  } catch (error) {
    console.error('Falha ao gerar/compartilhar PDF, salvando diretamente:', error);
    doc.save(filename);
  }
}
