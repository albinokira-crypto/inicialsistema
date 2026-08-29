function openMenuSection(targetDay) {
  handleMenuButtonClick(targetDay);
}
window.openMenuSection = openMenuSection;

function backToHomeMenu() {
  selectedOficinaForTodasVistorias = null;
  showOficinasInTodasVistorias = false;
  showWelcomeScreen();
  if (typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
window.backToHomeMenu = backToHomeMenu;

function homeLogout() {
  const savedFolder = localStorage.getItem('photo_folder_name_friendly');
  const savedCamera = localStorage.getItem('preferred_camera_label');
  localStorage.removeItem('authenticated');
  if (savedFolder) localStorage.setItem('photo_folder_name_friendly', savedFolder);
  if (savedCamera) localStorage.setItem('preferred_camera_label', savedCamera);
  window.location.href = 'index.html';
}
window.homeLogout = homeLogout;

const CURRENT_APP_VERSION = 'v2.04';

async function checkForSystemUpdates(showFeedback = false) {
  const versionEl = document.getElementById('systemAppVersionDisplay') || document.getElementById('systemVersionText');
  const serverJsonEl = document.getElementById('serverVersionJsonDisplay');
  const statusBadge = document.getElementById('systemVersionStatusBadge');
  const statusDot = document.getElementById('systemVersionStatusDot');
  const statusText = document.getElementById('systemVersionStatusText');

  let activeVersion = CURRENT_APP_VERSION;
  if (versionEl) versionEl.textContent = activeVersion;
  if (serverJsonEl && (!serverJsonEl.textContent || serverJsonEl.textContent === '...' || serverJsonEl.textContent === 'Verificando...')) {
    serverJsonEl.textContent = activeVersion;
  }

  try {
    const timestamp = Date.now();
    const endpoints = [
      'https://gestao-vistoria-inicial.vercel.app/version.json?_t=' + timestamp,
      '/version.json?_t=' + timestamp,
      'version.json?_t=' + timestamp
    ];
    let data = null;
    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, { 
          cache: 'no-store', 
          headers: { 
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }, 
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          data = await res.json();
          if (data && data.version) break;
        }
      } catch(e) {}
    }

    if (data && data.version) {
      const serverVer = data.version.startsWith('v') ? data.version : 'v' + data.version;
      if (serverJsonEl) serverJsonEl.textContent = serverVer;

      const isNewer = serverVer !== activeVersion;
      if (isNewer) {
        if (statusBadge) {
          statusBadge.style.background = '#fef3c7';
          statusBadge.style.borderColor = '#fde68a';
          statusBadge.style.color = '#92400e';
        }
        if (statusDot) statusDot.style.background = '#d97706';
        if (statusText) statusText.textContent = `Atualização ${serverVer}`;
        if (versionEl) versionEl.textContent = `${activeVersion} (Disponível ${serverVer})`;

        const lastAutoUpdate = sessionStorage.getItem('last_auto_update_target');
        if (lastAutoUpdate !== serverVer) {
          sessionStorage.setItem('last_auto_update_target', serverVer);
          forceAppRefresh();
          return;
        }

        if (showFeedback) {
          if (confirm(`Uma nova versão (${serverVer}) foi encontrada no servidor! Deseja atualizar o aplicativo agora?`)) {
            forceAppRefresh();
          }
        }
      } else {
        if (statusBadge) {
          statusBadge.style.background = '#dcfce7';
          statusBadge.style.borderColor = '#86efac';
          statusBadge.style.color = '#166534';
        }
        if (statusDot) statusDot.style.background = '#16a34a';
        if (statusText) statusText.textContent = 'Ativo / Atualizado';
        if (versionEl) versionEl.textContent = `${activeVersion}`;

        if (showFeedback) {
          alert(`✅ Seu aplicativo está na versão mais recente (${activeVersion}) conectada diretamente ao servidor!`);
        }
      }
    } else {
      if (serverJsonEl) serverJsonEl.textContent = activeVersion;
      if (statusBadge) {
        statusBadge.style.background = '#dcfce7';
        statusBadge.style.borderColor = '#86efac';
        statusBadge.style.color = '#166534';
      }
      if (statusDot) statusDot.style.background = '#16a34a';
      if (statusText) statusText.textContent = 'Ativo';
    }
  } catch (err) {
    if (serverJsonEl) serverJsonEl.textContent = activeVersion;
    if (statusBadge) {
      statusBadge.style.background = '#dcfce7';
      statusBadge.style.borderColor = '#86efac';
      statusBadge.style.color = '#166534';
    }
    if (statusDot) statusDot.style.background = '#16a34a';
    if (statusText) statusText.textContent = 'Ativo';
    if (showFeedback) {
      alert('Não foi possível verificar a versão no servidor.');
    }
  }
}

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
const appHeader = document.getElementById('appHeader');
const homeSummaryCard = document.getElementById('homeSummaryCard');
const homeSummaryGrid = document.getElementById('homeSummaryGrid');
const homeClearWeekButton = document.getElementById('homeClearWeekButton');
const homeLogoutButton = document.getElementById('homeLogoutButton');
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
const oficinaResponsaveisContainer = document.getElementById('oficinaResponsaveisContainer');
const addResponsavelBtn = document.getElementById('addResponsavelBtn');

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
const supervisaoOficinaFilterSelect = document.getElementById('supervisaoOficinaFilterSelect');
const supervisaoOficinaFilterCount = document.getElementById('supervisaoOficinaFilterCount');
const supervisaoOficinaSearchInput = document.getElementById('supervisaoOficinaSearchInput');
const supervisaoOficinaSearchClearBtn = document.getElementById('supervisaoOficinaSearchClearBtn');
const supervisaoReportContent = document.getElementById('supervisaoReportContent');

// Report Preview Modal Elements
const reportPreviewModal = document.getElementById('reportPreviewModal');
const reportPreviewTitle = document.getElementById('reportPreviewTitle');
const reportPreviewBadge = document.getElementById('reportPreviewBadge');
const reportPreviewMeta = document.getElementById('reportPreviewMeta');
const reportPreviewContent = document.getElementById('reportPreviewContent');
const partsReportPreviewBtn = document.getElementById('partsReportPreviewBtn');
const whatsappReportPreviewBtn = document.getElementById('whatsappReportPreviewBtn');
const photosReportPreviewBtn = document.getElementById('photosReportPreviewBtn');
let currentReportModalId = null;

const STAGES_STORAGE_KEY = 'web-system-stages-v1';
const DEFAULT_STAGES = [
  "Aguardando peças fora de serviço",
  "Em posse do proprietário",
  "Em lanternagem",
  "Em funilaria",
  "Em preparação de pintura",
  "Em pintura",
  "Em montagem",
  "Testes finais",
  "Finalizado e entregue",
  "Finalizado"
];

function loadStages() {
  const raw = localStorage.getItem(STAGES_STORAGE_KEY);
  if (!raw) return DEFAULT_STAGES;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_STAGES;
  }
}

function saveStages() {
  localStorage.setItem(STAGES_STORAGE_KEY, JSON.stringify(stages));
}

let deferredPrompt = null;
let items = loadItems();
let insurers = loadInsurers();
let oficinas = loadOficinas();
let supervisoes = loadSupervisoes();
let stages = loadStages();
let editingId = null;
let editingInsurerId = null;
let editingOficinaId = null;
let editingSupervisaoId = null;
let selectedDay = 'Seguradoras';
let selectedType = 'Inicial';
let appInitialized = false;
let selectedSupervisaoStage = 'Todos';
let selectedSupervisaoOficina = 'Todas';
let selectedOficinaForTodasVistorias = null;
let selectedTodasVistoriasFilter = 'Vistorias';
let selectedTodasVistoriasDateFilter = 'Todas';
let todasVistoriasOficinaSearchQuery = '';
let showOficinasInTodasVistorias = false;

function renderVistoriaOrSupervisaoCard(entry) {
  const badgeClasses = {
    'Inicial': 'badge-inicial',
    'Roubo Recuperado': 'badge-roubo',
    'Incêndio': 'badge-incendio',
    'Enchente': 'badge-enchente',
    'Moto': 'badge-moto',
    'Complemento': 'badge-complemento',
    'Pós entrega': 'badge-pos',
    'Vistoria Rio log': 'badge-riolog'
  };

  if (entry.isSupervisao) {
    const isLongVehicle = entry.vehicle && entry.vehicle.length > 20;
    const mainInfoStyle = isLongVehicle ? 'style="flex-direction: column; align-items: flex-start; gap: 6px; width: 100%;"' : '';
    const badgeStyle = isLongVehicle ? 'style="width: 100% !important; max-width: 100% !important; min-width: 100% !important; justify-content: flex-start !important; padding: 5px 8px !important; box-sizing: border-box;"' : '';
    const badgeTextStyle = isLongVehicle ? 'style="white-space: normal !important; word-break: break-word;"' : '';
    const dataUnica = entry.updatedAt || entry.createdAt || (entry.date ? formatDateString(entry.date) : '—');
    const ofObj = oficinas.find(o => o.id === entry.oficinaId);
    const ofName = entry.oficinaName || (ofObj ? ofObj.name : '');

    return `
      <li class="item-card compact-item-card">
        <div class="item-main-info" ${mainInfoStyle}>
          <div class="plate-badge compact-plate-badge clickable-plate-link" data-super-action="open-report" data-id="${entry.id}" title="Clique para abrir o relatório" style="cursor: pointer; ${badgeStyle}">
            <span class="plate-badge-text" ${badgeTextStyle}>🚗 ${escapeHtml(entry.vehicle || entry.plate || 'Supervisão')}</span>
          </div>
          <div class="item-details">
            <strong class="item-provider">${escapeHtml(entry.attended ? 'Atendido: ' + entry.attended : 'Sem atendente')}</strong>
            ${entry.plate && entry.plate !== entry.vehicle ? `<span class="item-meta">· Placa: <strong>${escapeHtml(entry.plate)}</strong></span>` : ''}
            ${entry.stage && entry.stage !== 'Supervisão' ? `<span class="badge-supervisao" style="margin-left: 6px;">${escapeHtml(entry.stage)}</span>` : ''}
            ${ofName ? `<div class="item-meta" style="margin-top: 4px; color: var(--color-slate-700);">Oficina: <strong>${escapeHtml(ofName)}</strong></div>` : ''}
            ${entry.partsPending === 'Sim' ? `<div class="item-meta" style="color: #b91c1c; margin-top: 2px;">Peças: <strong>${escapeHtml(entry.parts || 'Pendentes')}</strong></div>` : ''}
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 3px;">🕒 ${escapeHtml(dataUnica)}</div>
          </div>
        </div>
        <div class="actions card-actions-grid">
          <div class="btn-row">
            <button class="action-btn" type="button" data-super-action="photos" data-id="${entry.id}">📸 Fotos</button>
            <button class="action-btn" type="button" data-super-action="open-folder" data-id="${entry.id}">📂 Pasta</button>
            <button class="action-btn" type="button" data-super-action="edit" data-id="${entry.id}">Editar</button>
            <button class="action-btn" type="button" data-super-action="delete" data-id="${entry.id}">Excluir</button>
          </div>
          <div class="btn-row" style="margin-top: 4px; display: flex; gap: 6px;">
            <button class="action-btn" type="button" data-super-action="share-whatsapp-sequence" data-id="${entry.id}" style="font-weight: 800; font-size: 0.82rem !important; padding: 10px 8px !important; background: #16a34a; color: #ffffff; border: none; border-radius: 10px; flex: 2; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(22,163,74,0.2);">
              📲 Compartilhar (Texto + Fotos)
            </button>
            <button class="action-btn" type="button" data-super-action="share-whatsapp-text" data-id="${entry.id}" style="font-weight: 700; font-size: 0.80rem !important; padding: 10px 6px !important; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 10px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;">
              💬 Só Texto
            </button>
          </div>
        </div>
      </li>
    `;
  } else {
    const badgeClass = badgeClasses[entry.type || 'Inicial'] || 'badge-inicial';
    const isLongPlate = entry.plate && entry.plate.length > 20;
    const mainInfoStyle = isLongPlate ? 'style="flex-direction: column; align-items: flex-start; gap: 6px; width: 100%;"' : '';
    const badgeStyle = isLongPlate ? 'style="width: 100% !important; max-width: 100% !important; min-width: 100% !important; justify-content: flex-start !important; padding: 5px 8px !important; box-sizing: border-box;"' : '';
    const badgeTextStyle = isLongPlate ? 'style="white-space: normal !important; word-break: break-word;"' : '';
    const dataCriacao = entry.date ? formatDateString(entry.date) : (entry.createdAt || '—');
    const dataAtualizacao = entry.updatedAt || entry.createdAt || '—';
    const ofObj = oficinas.find(o => o.id === entry.oficinaId);
    const ofName = entry.oficinaName || (ofObj ? ofObj.name : '');

    return `
      <li class="item-card compact-item-card">
        <div class="item-main-info" ${mainInfoStyle}>
          <div class="plate-badge compact-plate-badge clickable-plate-link" data-action="open-report" data-id="${entry.id}" title="Clique para abrir o relatório" style="cursor: pointer; ${badgeStyle}">
            <span class="plate-badge-text" ${badgeTextStyle}>🚗 ${escapeHtml(entry.plate)}</span>
          </div>
          <div class="item-details">
            <strong class="item-provider">${escapeHtml(entry.provider || 'Sem seguradora')}</strong>
            <span class="item-meta">· R$ ${(Number(entry.value) || 0).toFixed(2).replace('.', ',')}</span>
            <span class="item-meta">· 📅 ${escapeHtml(dataCriacao)}</span>
            <span class="${badgeClass}" style="margin-left: 6px;">${escapeHtml(entry.type || 'Inicial')}</span>
            ${ofName ? `<div class="item-meta" style="margin-top: 4px; color: var(--color-slate-700);">Oficina: <strong>${escapeHtml(ofName)}</strong></div>` : ''}
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 3px;">🕒 Atualizado: ${escapeHtml(dataAtualizacao)}</div>
          </div>
        </div>
        <div class="actions card-actions-grid">
          <div class="btn-row">
            <button class="action-btn" type="button" data-action="photos" data-id="${entry.id}">📸 Fotos</button>
            <button class="action-btn" type="button" data-action="open-folder" data-id="${entry.id}">📂 Pasta</button>
            <button class="action-btn" type="button" data-action="edit" data-id="${entry.id}">Editar</button>
            <button class="action-btn" type="button" data-action="delete" data-id="${entry.id}">Excluir</button>
          </div>
          <div class="btn-row" style="margin-top: 4px; display: flex; gap: 6px;">
            <button class="action-btn" type="button" data-action="parts" data-id="${entry.id}" style="font-weight: 800; font-size: 0.82rem !important; padding: 10px 8px !important; background: #2563eb; color: #ffffff; border: none; border-radius: 10px; flex: 0.9; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
              🚗 Partes do Veículo
            </button>
            <button class="action-btn" type="button" data-action="share-whatsapp-sequence" data-id="${entry.id}" style="font-weight: 800; font-size: 0.82rem !important; padding: 10px 8px !important; background: #16a34a; color: #ffffff; border: none; border-radius: 10px; flex: 1.1; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(22,163,74,0.2);">
              📲 Enviar Vistoria
            </button>
          </div>
        </div>
      </li>
    `;
  }
}

function getAllAvailableDates(oficinaId = null) {
  const dateSet = new Set();
  items.forEach(item => {
    if (item.date && (!oficinaId || item.oficinaId === oficinaId)) {
      dateSet.add(item.date);
    }
  });
  supervisoes.forEach(s => {
    if (s.date && (!oficinaId || s.oficinaId === oficinaId)) {
      dateSet.add(s.date);
    }
  });
  const arr = Array.from(dateSet);
  arr.sort((a, b) => b.localeCompare(a));
  return arr;
}

function countRecordsForDate(dateVal, oficinaId = null) {
  const vCount = items.filter(item => item.date === dateVal && (!oficinaId || item.oficinaId === oficinaId)).length;
  const sCount = supervisoes.filter(s => s.date === dateVal && (!oficinaId || s.oficinaId === oficinaId)).length;
  return { total: vCount + sCount, vistorias: vCount, supervisoes: sCount };
}

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
  if (localStorage.getItem('authenticated') !== 'true') {
    window.location.href = 'index.html';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
    navigator.serviceWorker.register('/sw.js?v=204')
      .then((registration) => {
        registration.update();
      })
      .catch((error) => {
        console.warn('Registro do service worker falhou', error);
      });
  }
}

// Verificação automática de versão na inicialização e ao focar no app
setTimeout(() => {
  checkForSystemUpdates(false);
  try {
    if (window.AndroidInterface && typeof window.AndroidInterface.cleanupShareTemp === 'function') {
      window.AndroidInterface.cleanupShareTemp();
    }
  } catch (e) {}
}, 1200);

window.addEventListener('focus', () => {
  checkForSystemUpdates(false);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForSystemUpdates(false);
  }
});

function closeSystemSettings() {
  const modal = document.getElementById('systemSettingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function attachGlobalEventListeners() {
  // Logout (home)
  if (homeLogoutButton) {
    homeLogoutButton.addEventListener('click', () => {
      localStorage.removeItem('authenticated');
      window.location.href = 'index.html';
    });
  }

  // Logout (generic)
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('authenticated');
      window.location.href = 'index.html';
    });
  }

  // Settings button
  const systemSettingsBtn = document.getElementById('systemSettingsBtn');
  if (systemSettingsBtn) {
    systemSettingsBtn.addEventListener('click', () => {
      openSystemSettings();
    });
  }

  const closeSystemSettingsBtn = document.getElementById('closeSystemSettingsBtn');
  if (closeSystemSettingsBtn) {
    closeSystemSettingsBtn.addEventListener('click', () => {
      closeSystemSettings();
    });
  }

  // Share PDF button
  if (sharePdfButton) {
    sharePdfButton.addEventListener('click', () => generateWeeklyReportPDF());
  }

  // Share supervision text button
  if (shareSupervisaoTextButton) {
    shareSupervisaoTextButton.addEventListener('click', () => {
      const filtered = getFilteredSupervisoes();
      const text = formatAllSupervisoesText(filtered);
      shareSupervisaoText(text, 'Relatório de Supervisão');
    });
  }

  const supervisaoQuickAdd = document.getElementById('supervisaoQuickAddOficina');
  if (supervisaoQuickAdd) {
    supervisaoQuickAdd.addEventListener('click', (e) => {
      e.preventDefault();
      openQuickAddOficinaModal('supervisao');
    });
  }

  setupSupervisaoFormOficinaCombobox();

  const supervisaoQuickAddStage = document.getElementById('supervisaoQuickAddStage');
  if (supervisaoQuickAddStage) {
    supervisaoQuickAddStage.addEventListener('click', (e) => {
      e.preventDefault();
      const name = window.prompt('Digite o nome da nova etapa:');
      if (name && name.trim()) {
        const cleanedName = name.trim();
        const exists = stages.some(st => st.toLowerCase() === cleanedName.toLowerCase());
        if (exists) {
          alert('Esta etapa já está cadastrada!');
          return;
        }
        stages.push(cleanedName);
        saveStages();
        populateSupervisaoStageSelect();
        if (supervisaoStageInput) {
          supervisaoStageInput.value = cleanedName;
        }
      }
    });
  }

  function openStageManagerModal() {
    const modal = document.getElementById('stageManagerModal');
    if (!modal) return;
    renderStageManagerList();
    modal.style.display = 'flex';
  }
  window.openStageManagerModal = openStageManagerModal;

  function closeStageManagerModal() {
    const modal = document.getElementById('stageManagerModal');
    if (modal) modal.style.display = 'none';
  }
  window.closeStageManagerModal = closeStageManagerModal;

  function renderStageManagerList() {
    const list = document.getElementById('stageManagerList');
    if (!list) return;

    if (!stages.length) {
      list.innerHTML = '<li style="text-align: center; color: #94a3b8; padding: 12px;">Nenhuma etapa cadastrada.</li>';
      return;
    }

    list.innerHTML = stages.map((st) => `
      <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <span style="font-weight: 600; color: #1e293b; font-size: 0.9rem;">${escapeHtml(st)}</span>
        <button type="button" onclick="deleteStage('${escapeHtml(st).replace(/'/g, "\\'")}')" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 6px; padding: 4px 10px; font-weight: 700; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
          ❌ Excluir
        </button>
      </li>
    `).join('');
  }

  function deleteStage(stageName) {
    if (window.confirm(`Deseja realmente excluir a etapa "${stageName}"?`)) {
      stages = stages.filter(st => st !== stageName);
      saveStages();
      populateSupervisaoStageSelect();
      renderStageManagerList();
    }
  }
  window.deleteStage = deleteStage;

  if (homeClearWeekButton) {
    homeClearWeekButton.addEventListener('click', () => {
      const verification = window.prompt(
        '⚠️ CONFIRMAÇÃO:\n\n' +
        'Deseja limpar os registros da semana atual? Eles continuarão no relatório de "Todas as Vistorias".\n\n' +
        'Para confirmar, digite a palavra LIMPAR abaixo:'
      );
      if (verification && verification.trim().toUpperCase() === 'LIMPAR') {
        items.forEach((item) => {
          item.clearedFromWeek = true;
        });
        saveItems();
        updateHomeSummary();
        render();
      }
    });
  }
}

let serverSync = false;
let syncIntervalId = null;
let syncStatusLabel = null;

async function updateLocalAndServerData() {
  saveItems();
  saveInsurers();
  if (serverSync) {
    await syncDataToServer();
  }
}

function updateSyncStatus(message) {
  if (!syncStatusLabel) return;
  syncStatusLabel.textContent = message;
}


form.addEventListener('submit', saveItem);

let searchInputDebounce = null;
if (searchInput) {
  searchInput.addEventListener('input', () => {
    if (clearSearchButton) {
      clearSearchButton.hidden = !searchInput.value.trim();
    }
    if (searchInputDebounce) clearTimeout(searchInputDebounce);
    searchInputDebounce = setTimeout(() => {
      render();
    }, 120);
  });
}

if (clearSearchButton) {
  clearSearchButton.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      clearSearchButton.hidden = true;
      render();
      searchInput.focus();
    }
  });
}
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
    updateVistoriaFormTitle();
  }

  updateDayTabs();
  render();
});
cancelEditButton.addEventListener('click', cancelEdit);
if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('authenticated');
    window.location.href = 'index.html';
  });
}
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
if (addResponsavelBtn) {
  addResponsavelBtn.addEventListener('click', () => {
    addResponsavelRow();
  });
}
if (supervisaoOficinaSelect) {
  supervisaoOficinaSelect.addEventListener('change', () => {
    populateSupervisaoAttendedSelect();
  });
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
    if (window.confirm('Deseja apagar permanentemente todos os registros de todas as vistorias e supervisões?')) {
      items = [];
      supervisoes = [];
      saveItems();
      saveSupervisoes();
      render();
      renderSupervisaoReport();
    }
  });
}

function updateVistoriaFormTitle() {
  const formTitleEl = document.getElementById('formTitle');
  if (!formTitleEl) return;
  const currentDay = getSelectedSaveDay() || getWeekdayName(new Date());
  const isEditing = Boolean(editingId);
  
  if (selectedDay === 'Seguradoras') {
    formTitleEl.innerHTML = `
      <div class="form-title-wrapper">
        <div class="form-title-primary">
          <span class="form-title-icon">🏢</span>
          <span class="form-title-text">${isEditing ? 'Editar Seguradora' : 'Cadastrar Seguradoras'}</span>
        </div>
      </div>
    `;
    return;
  }
  
  if (selectedDay === 'Oficinas') {
    formTitleEl.innerHTML = `
      <div class="form-title-wrapper">
        <div class="form-title-primary">
          <span class="form-title-icon">🔧</span>
          <span class="form-title-text">${isEditing ? 'Editar Oficina' : 'Cadastrar Oficinas'}</span>
        </div>
      </div>
    `;
    return;
  }

  const typeName = selectedType || 'Inicial';
  const badgeClasses = {
    'Inicial': 'badge-inicial',
    'Roubo Recuperado': 'badge-roubo',
    'Incêndio': 'badge-incendio',
    'Enchente': 'badge-enchente',
    'Moto': 'badge-moto',
    'Complemento': 'badge-complemento',
    'Pós entrega': 'badge-pos',
    'Vistoria Rio log': 'badge-riolog'
  };
  const typeIcons = {
    'Inicial': '🚗',
    'Roubo Recuperado': '🚨',
    'Incêndio': '🔥',
    'Enchente': '🌊',
    'Moto': '🏍️',
    'Complemento': '📄',
    'Pós entrega': '📦',
    'Vistoria Rio log': '🚛'
  };

  const badgeClass = badgeClasses[typeName] || 'badge-inicial';
  const typeIcon = typeIcons[typeName] || '📋';
  const dayDisplay = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].includes(currentDay) ? `${currentDay}-feira` : currentDay;

  formTitleEl.innerHTML = `
    <div class="form-title-wrapper">
      <div class="form-title-primary">
        <span class="form-title-status-indicator ${isEditing ? 'editing' : 'new'}">
          ${isEditing ? '✏️ Editar Registro' : '✨ Novo Registro'}
        </span>
        <span class="${badgeClass} form-title-type-badge">
          ${typeIcon} ${escapeHtml(typeName)}
        </span>
      </div>
      <div class="form-title-secondary">
        <span class="form-title-day-badge">
          📅 ${escapeHtml(dayDisplay)}
        </span>
      </div>
    </div>
  `;
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
    
    updateVistoriaFormTitle();
    
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



let selectedVistoriaOficina = 'Todas';

function setupOficinaCombobox({
  inputId,
  clearBtnId,
  toggleBtnId,
  listId,
  getItems,
  getSelectedOficina,
  setSelectedOficina,
  onSelectionChange
}) {
  const inputEl = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearBtnId);
  const toggleBtn = document.getElementById(toggleBtnId);
  const listEl = document.getElementById(listId);

  if (!inputEl || !listEl) return;

  function renderDropdown(filterText = '') {
    const q = filterText.trim().toLowerCase();
    const currentSelected = getSelectedOficina();
    const allItems = getItems();
    const totalCount = allItems.length;

    const matchingOficinas = q
      ? oficinas.filter(o => o.name.toLowerCase().includes(q))
      : oficinas;

    let html = `
      <li data-oficina-id="Todas" style="padding: 10px 14px; font-size: 0.88rem; font-weight: 700; color: ${currentSelected === 'Todas' ? '#16a34a' : '#2563eb'}; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: ${currentSelected === 'Todas' ? '#f0fdf4' : 'transparent'};">
        <span>🏢 Todas as Oficinas</span>
        <span style="font-size: 0.75rem; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 999px;">${totalCount}</span>
      </li>
    `;

    if (matchingOficinas.length === 0) {
      html += `<li style="padding: 12px 14px; font-size: 0.85rem; color: #94a3b8; text-align: center;">Nenhuma oficina encontrada</li>`;
    } else {
      matchingOficinas.forEach(oficina => {
        const count = allItems.filter(item => item.oficinaId === oficina.id).length;
        const isSel = currentSelected === oficina.id;
        html += `
          <li data-oficina-id="${oficina.id}" data-name="${escapeHtml(oficina.name)}" style="padding: 10px 14px; font-size: 0.88rem; font-weight: 600; color: ${isSel ? '#16a34a' : '#0f172a'}; cursor: pointer; border-bottom: 1px solid #f8fafc; display: flex; justify-content: space-between; align-items: center; background: ${isSel ? '#f0fdf4' : 'transparent'};">
            <span>${escapeHtml(oficina.name)}</span>
            <span style="font-size: 0.75rem; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 999px;">${count}</span>
          </li>
        `;
      });
    }

    listEl.innerHTML = html;
  }

  function openDropdown() {
    renderDropdown(inputEl.value.startsWith('🏢') ? '' : inputEl.value);
    listEl.style.display = 'block';
  }

  function closeDropdown() {
    listEl.style.display = 'none';
  }

  function selectOficina(oficinaId, oficinaName) {
    setSelectedOficina(oficinaId);
    if (oficinaId === 'Todas') {
      inputEl.value = '';
      inputEl.placeholder = '🏢 Todas as Oficinas (digite ou selecione...)';
      if (clearBtn) clearBtn.style.display = 'none';
    } else {
      inputEl.value = oficinaName;
      if (clearBtn) clearBtn.style.display = 'block';
    }
    closeDropdown();
    onSelectionChange();
  }

  inputEl.addEventListener('focus', () => {
    openDropdown();
  });

  inputEl.addEventListener('input', (e) => {
    const val = e.target.value;
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    renderDropdown(val);
    listEl.style.display = 'block';
    
    if (!val.trim()) {
      setSelectedOficina('Todas');
      onSelectionChange();
    } else {
      const matchExact = oficinas.find(o => o.name.toLowerCase() === val.trim().toLowerCase());
      if (matchExact) {
        setSelectedOficina(matchExact.id);
      } else {
        setSelectedOficina('Todas');
      }
      onSelectionChange();
    }
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (listEl.style.display === 'block') {
        closeDropdown();
      } else {
        openDropdown();
        inputEl.focus();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectOficina('Todas', '');
    });
  }

  listEl.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-oficina-id]');
    if (!li) return;
    const id = li.dataset.oficinaId;
    const name = li.dataset.name || '🏢 Todas as Oficinas';
    selectOficina(id, name);
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
      closeDropdown();
    }
  });
}

// Inicializa o combobox na Supervisão
setupOficinaCombobox({
  inputId: 'supervisaoOficinaComboboxInput',
  clearBtnId: 'supervisaoOficinaComboboxClearBtn',
  toggleBtnId: 'supervisaoOficinaComboboxToggleBtn',
  listId: 'supervisaoOficinaComboboxList',
  getItems: () => supervisoes,
  getSelectedOficina: () => selectedSupervisaoOficina,
  setSelectedOficina: (val) => { selectedSupervisaoOficina = val; },
  onSelectionChange: () => renderSupervisaoReport()
});

// Inicializa o combobox em Todas as Vistorias
setupOficinaCombobox({
  inputId: 'vistoriaOficinaComboboxInput',
  clearBtnId: 'vistoriaOficinaComboboxClearBtn',
  toggleBtnId: 'vistoriaOficinaComboboxToggleBtn',
  listId: 'vistoriaOficinaComboboxList',
  getItems: () => items,
  getSelectedOficina: () => selectedVistoriaOficina,
  setSelectedOficina: (val) => { selectedVistoriaOficina = val; },
  onSelectionChange: () => render()
});

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

function openReportModal(id) {
  const item = items.find(entry => entry.id === id) || supervisoes.find(s => s.id === id);
  if (!item) {
    alert('Registro não encontrado!');
    return;
  }
  currentReportModalId = id;

  const isInspection = items.some(entry => entry.id === id);
  const vehicleName = (item.plate || item.vehicle || 'Veículo').trim();
  const reportText = isInspection ? getSurveyText(id) : formatSingleSupervisaoText(item);

  const modalEl = document.getElementById('reportPreviewModal');
  const titleEl = document.getElementById('reportPreviewTitle');
  const badgeEl = document.getElementById('reportPreviewBadge');
  const metaEl = document.getElementById('reportPreviewMeta');
  const contentEl = document.getElementById('reportPreviewContent');

  if (titleEl) titleEl.textContent = `📋 Relatório: ${vehicleName}`;
  if (badgeEl) {
    if (isInspection) {
      badgeEl.textContent = item.type || 'Vistoria';
      badgeEl.className = 'badge-inicial';
    } else {
      badgeEl.textContent = `Supervisão: ${item.stage || 'Em andamento'}`;
      badgeEl.className = 'badge-supervisao';
    }
  }
  if (metaEl) {
    if (isInspection) {
      const dataCriacao = item.date ? formatDateString(item.date) : (item.createdAt || '—');
      const dataAtualizacao = item.updatedAt || item.createdAt || '—';
      metaEl.innerHTML = `📅 <strong>Data:</strong> ${escapeHtml(dataCriacao)} &nbsp;|&nbsp; 🕒 <strong>Última Atualização:</strong> ${escapeHtml(dataAtualizacao)}`;
    } else {
      const dataUnica = item.updatedAt || item.createdAt || (item.date ? formatDateString(item.date) : '—');
      metaEl.innerHTML = `🕒 <strong>Última Atualização:</strong> ${escapeHtml(dataUnica)}`;
    }
  }
  if (contentEl) {
    contentEl.value = reportText;
  }

  if (modalEl) {
    modalEl.style.display = 'flex';
  }
}

function closeReportPreviewModal() {
  const modalEl = document.getElementById('reportPreviewModal');
  if (modalEl) {
    modalEl.style.display = 'none';
  }
  currentReportModalId = null;
}

// Listeners dos botões de ação do modal de relatório do veículo
if (partsReportPreviewBtn) {
  partsReportPreviewBtn.addEventListener('click', () => {
    if (!currentReportModalId) return;
    const targetId = currentReportModalId;
    closeReportPreviewModal();
    if (typeof window.openVehiclePartsForVistoriaId === 'function') {
      window.openVehiclePartsForVistoriaId(targetId);
    } else if (typeof window.openVehiclePartsModalForId === 'function') {
      window.openVehiclePartsModalForId(targetId);
    }
  });
}

if (whatsappReportPreviewBtn) {
  whatsappReportPreviewBtn.addEventListener('click', () => {
    if (!currentReportModalId) return;
    if (typeof shareVistoriaWhatsAppSequence === 'function') {
      shareVistoriaWhatsAppSequence(currentReportModalId);
    }
  });
}

if (photosReportPreviewBtn) {
  photosReportPreviewBtn.addEventListener('click', () => {
    if (!currentReportModalId) return;
    if (typeof openPhotoManagerForId === 'function') {
      openPhotoManagerForId(currentReportModalId);
    }
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

function updateHomeSummary() {
  const summaryGridEl = document.getElementById('homeSummaryGrid');
  if (!summaryGridEl) return;
  const statsItems = items.filter(item => item.clearedFromWeek !== true);
  
  // Vistorias com valor vs Vistorias Extras (sem valor ou valor <= 0)
  const vistoriasComValor = statsItems.filter(item => Number(item.value) > 0);
  const vistoriasExtras = statsItems.filter(item => !item.value || Number(item.value) <= 0 || isNaN(Number(item.value)));
  
  const countComValor = vistoriasComValor.length;
  const countExtras = vistoriasExtras.length;
  const totalValue = statsItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const uniqueDays = new Set(statsItems.map((item) => item.day)).size;
  const lastRecord = statsItems.length ? (statsItems[0].date ? formatDateString(statsItems[0].date) : (statsItems[0].createdAt || '—')) : '—';

  summaryGridEl.innerHTML = `
    <!-- LINHA 1 (3 CARDS) -->
    <article class="summary-item summary-item-top" style="grid-column: span 2; background: #eff6ff; border: 1px solid #bfdbfe; padding: 10px 4px; border-radius: 12px; text-align: center;">
      <strong style="font-size: 1.25rem; color: #1e40af; display: block; font-weight: 800;">${countComValor}</strong>
      <span style="font-size: 0.70rem; color: #2563eb; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">Vistorias</span>
    </article>

    <article class="summary-item summary-item-top" style="grid-column: span 2; background: #fff7ed; border: 1px solid #fed7aa; padding: 10px 4px; border-radius: 12px; text-align: center;">
      <strong style="font-size: 1.25rem; color: #c2410c; display: block; font-weight: 800;">${countExtras}</strong>
      <span style="font-size: 0.70rem; color: #ea580c; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">Vistorias Extras</span>
    </article>

    <article class="summary-item summary-item-top" style="grid-column: span 2; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px 4px; border-radius: 12px; text-align: center;">
      <strong style="font-size: 1.10rem; color: #065f46; display: block; font-weight: 800;">R$ ${totalValue.toFixed(2).replace('.', ',')}</strong>
      <span style="font-size: 0.70rem; color: #059669; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">Valor Total</span>
    </article>

    <!-- LINHA 2 (2 CARDS DO MESMO TAMANHO) -->
    <article class="summary-item summary-item-bottom" style="grid-column: span 3; background: #fefce8; border: 1px solid #fef08a; padding: 10px 6px; border-radius: 12px; text-align: center;">
      <strong style="font-size: 1.20rem; color: #854d0e; display: block; font-weight: 800;">${uniqueDays}</strong>
      <span style="font-size: 0.72rem; color: #ca8a04; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">Dias Preenchidos</span>
    </article>

    <article class="summary-item summary-item-bottom" style="grid-column: span 3; background: #f3e8ff; border: 1px solid #e9d5ff; padding: 10px 6px; border-radius: 12px; text-align: center;">
      <strong style="font-size: 0.95rem; color: #6b21a8; display: block; word-break: break-word; font-weight: 800;">${lastRecord}</strong>
      <span style="font-size: 0.72rem; color: #9333ea; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">Último Registro</span>
    </article>
  `;
}

function showWelcomeScreen() {
  const welcomeScreenEl = document.getElementById('welcomeScreen');
  const homeSummaryCardEl = document.getElementById('homeSummaryCard');
  const appHeaderEl = document.getElementById('appHeader');
  const appContentEl = document.getElementById('appContent');

  if (welcomeScreenEl) {
    welcomeScreenEl.hidden = false;
    welcomeScreenEl.style.display = 'block';
  }
  if (homeSummaryCardEl) {
    homeSummaryCardEl.hidden = false;
    homeSummaryCardEl.style.display = 'block';
  }
  if (appHeaderEl) appHeaderEl.style.display = 'flex';
  if (appContentEl) {
    appContentEl.hidden = true;
    appContentEl.style.display = 'none';
  }
  updateHomeSummary();
}

function getAutomaticDayOfWeek() {
  const dayIndex = new Date().getDay();
  const map = {
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta'
  };
  return map[dayIndex] || 'Segunda';
}

function handleMenuButtonClick(targetDay) {
  try {
    const welcomeScreenEl = document.getElementById('welcomeScreen');
    const homeSummaryCardEl = document.getElementById('homeSummaryCard');
    const appHeaderEl = document.getElementById('appHeader');
    const appContentEl = document.getElementById('appContent');

    if (targetDay === 'Vistorias') {
      selectedDay = getAutomaticDayOfWeek();
    } else {
      selectedDay = targetDay;
    }
    
    if (['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].includes(selectedDay)) {
      selectedType = 'Inicial';
      const typeTabsEl = document.getElementById('vistoriaTypeTabs');
      if (typeTabsEl) {
        typeTabsEl.querySelectorAll('.tab-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.type === 'Inicial');
        });
      }
      const typeInputEl = document.getElementById('typeInput');
      if (typeInputEl) typeInputEl.value = 'Inicial';
      updateVistoriaFormTitle();
    }
    
    if (welcomeScreenEl) {
      welcomeScreenEl.hidden = true;
      welcomeScreenEl.style.display = 'none';
    }
    if (homeSummaryCardEl) {
      homeSummaryCardEl.hidden = true;
      homeSummaryCardEl.style.display = 'none';
    }
    if (appHeaderEl) appHeaderEl.style.display = 'none';
    if (appContentEl) {
      appContentEl.hidden = false;
      appContentEl.style.display = 'block';
    }

    updateDayTabs();
    render();
    if (selectedDay === 'Supervisão') {
      populateSupervisaoOficinaSelect();
      populateSupervisaoOficinaFilter();
      populateSupervisaoStageSelect();
      renderSupervisaoReport();
    } else if (selectedDay === 'Seguradoras') {
      renderInsurers();
    } else if (selectedDay === 'Oficinas') {
      renderOficinas();
    }

    updatePageTitleHeader();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error('Erro ao abrir seção:', err);
  }
}

window.openMenuSection = function(targetDay) {
  handleMenuButtonClick(targetDay);
};

window.backToHomeMenu = function() {
  selectedOficinaForTodasVistorias = null;
  showWelcomeScreen();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.homeClearWeek = function() {
  const verification = window.prompt(
    '⚠️ CONFIRMAÇÃO:\n\n' +
    'Deseja limpar os registros da semana atual? Eles continuarão no relatório de "Todas as Vistorias".\n\n' +
    'Para confirmar, digite a palavra LIMPAR abaixo:'
  );
  if (verification && verification.trim().toUpperCase() === 'LIMPAR') {
    items.forEach((item) => {
      item.clearedFromWeek = true;
    });
    saveItems();
    updateHomeSummary();
    render();
  }
};

window.openSystemSettings = function() {
  const modal = document.getElementById('systemSettingsModal');
  if (modal) modal.style.display = 'flex';
};

window.closeSystemSettings = function() {
  const modal = document.getElementById('systemSettingsModal');
  if (modal) modal.style.display = 'none';
};

function attachMenuListeners() {
  if (backToMenuButton) {
    backToMenuButton.addEventListener('click', (e) => {
      e.preventDefault();
      selectedOficinaForTodasVistorias = null;
      showWelcomeScreen();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

function initAppWithDOM() {
  initializeApp();
  showWelcomeScreen();
  attachMenuListeners();
  attachGlobalEventListeners();
}

if (window.AndroidInterface || window.location.protocol === 'file:') {
  localStorage.setItem('authenticated', 'true');
}

if (localStorage.getItem('authenticated') !== 'true') {
  window.location.href = 'index.html';
} else {
  registerServiceWorker();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppWithDOM);
  } else {
    initAppWithDOM();
  }
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
    const existing = items.find((i) => i.id === editingId);
    const mergedDetails = { ...(existing?.details || {}), ...details };
    items = items.map((item) => item.id === editingId ? { 
      ...item, date, day, plate, provider, value, providerId, type, oficinaId, oficinaName, details: mergedDetails,
      updatedAt: new Date().toLocaleString('pt-BR'),
      updatedAtTime: Date.now()
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
      createdAt: new Date().toLocaleString('pt-BR'),
      updatedAt: new Date().toLocaleString('pt-BR'),
      updatedAtTime: Date.now()
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
  updateLocalAndServerData();
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
  updateLocalAndServerData();
}

function render() {
  const query = searchInput.value.toLowerCase();
  const isTodasVistorias = selectedDay === 'Todas as vistorias';

  if (summaryGrid) {
    // Show summaryGrid only on "Mês vigente" (which is now replaced, but keep compatibility or hide it)
    summaryGrid.style.display = 'none';
  }

  if (isTodasVistorias) {
    clearSearchButton.hidden = !query;
    installButton.hidden = !deferredPrompt;

    if (reportCard) reportCard.hidden = true;
    if (formCard) formCard.hidden = true;
    if (recordsCard) recordsCard.hidden = false;

    const allDates = getAllAvailableDates();
    const totalAllRecords = items.length + supervisoes.length;

    function attachCardActionListeners() {
      itemList.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', () => handleAction(button.dataset.action, button.dataset.id));
      });
      itemList.querySelectorAll('[data-super-action]').forEach((button) => {
        button.addEventListener('click', () => handleSupervisaoAction(button.dataset.superAction, button.dataset.id));
      });
      const toggleVistoriasBtn = itemList.querySelector('#toggleFilterVistorias');
      const toggleSupervisoesBtn = itemList.querySelector('#toggleFilterSupervisoes');
      if (toggleVistoriasBtn) {
        toggleVistoriasBtn.addEventListener('click', () => {
          selectedTodasVistoriasFilter = 'Vistorias';
          render();
        });
      }
      if (toggleSupervisoesBtn) {
        toggleSupervisoesBtn.addEventListener('click', () => {
          selectedTodasVistoriasFilter = 'Supervisões';
          render();
        });
      }
    }

    // =========================================================================
    // CASO 1: BUSCA GLOBAL POR DIGITAÇÃO (Placa, Seguradora, Dia, Oficina, etc.)
    // =========================================================================
    if (query) {
      const q = query.trim().toLowerCase();
      const filteredVistorias = items.filter(item => {
        const dStr = item.date ? formatDateString(item.date) : '';
        const ofName = item.oficinaName || (oficinas.find(o => o.id === item.oficinaId) ? oficinas.find(o => o.id === item.oficinaId).name : '');
        const fullText = `${item.date || ''} ${dStr} ${item.day || ''} ${item.plate || ''} ${item.provider || ''} ${item.type || ''} ${ofName} ${JSON.stringify(item.details || {})}`.toLowerCase();
        return fullText.includes(q);
      });

      const filteredSupervisoes = supervisoes.filter(s => {
        const dStr = s.date ? formatDateString(s.date) : '';
        const ofName = s.oficinaName || (oficinas.find(o => o.id === s.oficinaId) ? oficinas.find(o => o.id === s.oficinaId).name : '');
        const fullText = `${s.date || ''} ${dStr} ${s.day || ''} ${s.vehicle || ''} ${s.plate || ''} ${s.attended || ''} ${s.stage || ''} ${ofName} ${s.parts || ''} ${s.other || ''}`.toLowerCase();
        return fullText.includes(q);
      });

      // Alterna automaticamente para a aba com resultados se a aba atual estiver vazia
      if (filteredVistorias.length === 0 && filteredSupervisoes.length > 0 && selectedTodasVistoriasFilter === 'Vistorias') {
        selectedTodasVistoriasFilter = 'Supervisões';
      } else if (filteredSupervisoes.length === 0 && filteredVistorias.length > 0 && selectedTodasVistoriasFilter === 'Supervisões') {
        selectedTodasVistoriasFilter = 'Vistorias';
      }

      let listToDisplay = [];
      if (selectedTodasVistoriasFilter === 'Vistorias') {
        listToDisplay = filteredVistorias.map(i => ({ ...i, isSupervisao: false }));
        listToDisplay.sort((a, b) => b.id.localeCompare(a.id));
      } else {
        listToDisplay = filteredSupervisoes.map(s => ({ ...s, isSupervisao: true }));
        listToDisplay.sort((a, b) => {
          const timeA = a.updatedAtTime || Number(a.id) || 0;
          const timeB = b.updatedAtTime || Number(b.id) || 0;
          return timeB - timeA;
        });
      }

      const headerHtml = `
        <li style="list-style: none; grid-column: 1 / -1; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; flex-wrap: wrap; gap: 8px;">
            <div>
              <strong style="color: #1e40af; font-size: 0.92rem;">🔍 Resultados para: "${escapeHtml(query)}"</strong>
              <div style="font-size: 0.75rem; color: #3b82f6; font-weight: 600;">${filteredVistorias.length + filteredSupervisoes.length} registro(s) encontrado(s)</div>
            </div>
            <button id="clearGlobalSearchBtn" class="ghost-btn" style="font-size: 0.76rem; padding: 6px 12px; width: auto; font-weight: 700; background: #ffffff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 999px; cursor: pointer;">
              ✕ Limpar Busca
            </button>
          </div>
          <div class="tabs" style="display: flex; gap: 8px; width: 100%;">
            <button class="tab-btn ${selectedTodasVistoriasFilter === 'Vistorias' ? 'active' : ''}" type="button" id="toggleFilterVistorias" style="flex: 1; text-align: center; font-weight: 700; border-radius: 12px; padding: 12px 16px;">
              Vistorias (${filteredVistorias.length})
            </button>
            <button class="tab-btn ${selectedTodasVistoriasFilter === 'Supervisões' ? 'active' : ''}" type="button" id="toggleFilterSupervisoes" style="flex: 1; text-align: center; font-weight: 700; border-radius: 12px; padding: 12px 16px;">
              Supervisões (${filteredSupervisoes.length})
            </button>
          </div>
        </li>
      `;

      const itemsHtml = listToDisplay.map(renderVistoriaOrSupervisaoCard).join('');
      itemList.innerHTML = headerHtml + (listToDisplay.length ? itemsHtml : `<li class="empty">Nenhum registro de ${selectedTodasVistoriasFilter.toLowerCase()} encontrado para "${escapeHtml(query)}".</li>`);

      const clearBtn = itemList.querySelector('#clearGlobalSearchBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          searchInput.value = '';
          render();
          searchInput.focus();
        });
      }
      attachCardActionListeners();
      return;
    }

    // =========================================================================
    // CASO 2: VISUALIZANDO UMA OFICINA ESPECÍFICA
    // =========================================================================
    if (selectedOficinaForTodasVistorias !== null) {
      const o = oficinas.find(oficina => oficina.id === selectedOficinaForTodasVistorias) || { name: 'Sem oficina' };

      const filteredVistorias = items.filter(item => {
        if (item.oficinaId !== selectedOficinaForTodasVistorias) return false;
        if (selectedTodasVistoriasDateFilter !== 'Todas' && item.date !== selectedTodasVistoriasDateFilter) return false;
        return true;
      });
      const filteredSupervisoes = supervisoes.filter(s => {
        if (s.oficinaId !== selectedOficinaForTodasVistorias) return false;
        if (selectedTodasVistoriasDateFilter !== 'Todas' && s.date !== selectedTodasVistoriasDateFilter) return false;
        return true;
      });
      
      let listToDisplay = [];
      if (selectedTodasVistoriasFilter === 'Vistorias') {
        listToDisplay = filteredVistorias.map(i => ({ ...i, isSupervisao: false }));
        listToDisplay.sort((a, b) => b.id.localeCompare(a.id));
      } else {
        listToDisplay = filteredSupervisoes.map(s => ({ ...s, isSupervisao: true }));
        listToDisplay.sort((a, b) => {
          const timeA = a.updatedAtTime || Number(a.id) || 0;
          const timeB = b.updatedAtTime || Number(b.id) || 0;
          return timeB - timeA;
        });
      }
      
      const headerHtml = `
        <li style="list-style: none; grid-column: 1 / -1; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
            <strong style="color: #15803d; font-size: 0.95rem;">🏢 Oficina: ${escapeHtml(o.name)}</strong>
            <button id="backToOficinasList" class="ghost-btn" style="font-size: 0.76rem; padding: 6px 12px; width: auto; font-weight: 700; background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; border-radius: 999px; cursor: pointer;">
              ← Voltar às Oficinas
            </button>
          </div>
          <div class="tabs" style="display: flex; gap: 8px; width: 100%;">
            <button class="tab-btn ${selectedTodasVistoriasFilter === 'Vistorias' ? 'active' : ''}" type="button" id="toggleFilterVistorias" style="flex: 1; text-align: center; font-weight: 700; border-radius: 12px; padding: 12px 16px;">
              Vistorias (${filteredVistorias.length})
            </button>
            <button class="tab-btn ${selectedTodasVistoriasFilter === 'Supervisões' ? 'active' : ''}" type="button" id="toggleFilterSupervisoes" style="flex: 1; text-align: center; font-weight: 700; border-radius: 12px; padding: 12px 16px;">
              Supervisões (${filteredSupervisoes.length})
            </button>
          </div>
        </li>
      `;

      const itemsHtml = listToDisplay.map(renderVistoriaOrSupervisaoCard).join('');
      itemList.innerHTML = headerHtml + (listToDisplay.length ? itemsHtml : `<li class="empty">Nenhum registro de ${selectedTodasVistoriasFilter.toLowerCase()} encontrado para esta oficina.</li>`);
      
      const backBtn = itemList.querySelector('#backToOficinasList');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          selectedOficinaForTodasVistorias = null;
          showOficinasInTodasVistorias = true;
          render();
        });
      }
      attachCardActionListeners();
      return;
    }

    // =========================================================================
    // CASO 3: EXIBIR LISTA DE OFICINAS (Quando showOficinasInTodasVistorias === true)
    // =========================================================================
    if (showOficinasInTodasVistorias) {
      const ofQuery = (todasVistoriasOficinaSearchQuery || '').trim().toLowerCase();
      const filteredOficinas = ofQuery ? oficinas.filter(o => o.name.toLowerCase().includes(ofQuery)) : oficinas;

      itemList.innerHTML = `
        <li style="list-style: none; grid-column: 1 / -1; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; width: 100%; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="margin: 0; color: #1e40af; font-size: 1rem; font-weight: 700;">🏢 Lista de Oficinas</h3>
              <span style="font-size: 0.75rem; font-weight: 700; background: #eff6ff; color: #2563eb; padding: 2px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">${filteredOficinas.length} oficinas</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button id="btnOcultarOficinas" class="ghost-btn" style="font-size: 0.78rem; padding: 6px 12px; width: auto; font-weight: 700; background: #eff6ff; color: #1e40af; border: 1.5px solid #93c5fd; border-radius: 8px; cursor: pointer;">
                ✕ Ocultar Oficinas
              </button>
              <button id="tabClearAllButton" class="ghost-btn" style="font-size: 0.76rem; padding: 6px 12px; width: auto; font-weight: 700; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 999px; cursor: pointer;">
                🧹 Limpar Tudo
              </button>
            </div>
          </div>

          <!-- Campo de Busca por Digitação para Oficinas -->
          <div style="position: relative; width: 100%;">
            <input id="todasVistoriasOficinaSearchInput" type="text" placeholder="🔍 Digite para procurar a oficina..." value="${escapeHtml(todasVistoriasOficinaSearchQuery || '')}" style="width: 100%; padding: 9px 34px 9px 12px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-size: 0.88rem; font-weight: 600; box-sizing: border-box; outline: none; background: #ffffff; color: #0f172a;" />
            <button id="todasVistoriasOficinaSearchClearBtn" type="button" style="display: ${todasVistoriasOficinaSearchQuery ? 'block' : 'none'}; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 1.1rem; color: #94a3b8; cursor: pointer; padding: 4px;">✕</button>
          </div>
        </li>

        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
          ${filteredOficinas.map(o => {
            const count = (items.filter(i => i.oficinaId === o.id).length) + (supervisoes.filter(s => s.oficinaId === o.id).length);
            return `
              <div class="oficina-list-card" data-oficina-btn-id="${o.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 1.25rem;">🏢</span>
                  <strong style="color: #1e3a8a; font-size: 0.92rem;">${escapeHtml(o.name)}</strong>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 0.75rem; font-weight: 700; background: ${count > 0 ? '#eff6ff' : '#f1f5f9'}; color: ${count > 0 ? '#2563eb' : '#64748b'}; border: 1px solid ${count > 0 ? '#bfdbfe' : '#e2e8f0'}; padding: 3px 10px; border-radius: 999px;">
                    ${count} registros
                  </span>
                  <span style="color: #94a3b8; font-size: 1.1rem; font-weight: bold;">›</span>
                </div>
              </div>
            `;
          }).join('')}
          ${!filteredOficinas.length ? '<div style="text-align: center; padding: 16px; color: #64748b; font-size: 0.88rem;">Nenhuma oficina encontrada com esse nome.</div>' : ''}
        </div>
      `;

      const ofSearchInput = itemList.querySelector('#todasVistoriasOficinaSearchInput');
      const ofClearBtn = itemList.querySelector('#todasVistoriasOficinaSearchClearBtn');
      if (ofSearchInput) {
        ofSearchInput.addEventListener('input', (e) => {
          todasVistoriasOficinaSearchQuery = e.target.value;
          render();
          const freshInput = document.getElementById('todasVistoriasOficinaSearchInput');
          if (freshInput) {
            freshInput.focus();
            const len = freshInput.value.length;
            freshInput.setSelectionRange(len, len);
          }
        });
      }
      if (ofClearBtn) {
        ofClearBtn.addEventListener('click', () => {
          todasVistoriasOficinaSearchQuery = '';
          render();
        });
      }

      const btnOcultar = itemList.querySelector('#btnOcultarOficinas');
      if (btnOcultar) {
        btnOcultar.addEventListener('click', () => {
          showOficinasInTodasVistorias = false;
          render();
        });
      }

      const clearAllBtn = itemList.querySelector('#tabClearAllButton');
      if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
          const verification = window.prompt(
            '⚠️ AVISO DE SEGURANÇA:\n\n' +
            'Esta ação irá apagar PERMANENTEMENTE todos os registros cadastrados (vistorias e supervisões) de todas as oficinas.\n' +
            'Esta ação não poderá ser desfeita.\n\n' +
            'Para confirmar que deseja prosseguir, digite a palavra APAGAR no campo abaixo:'
          );
          if (verification && verification.trim().toUpperCase() === 'APAGAR') {
            items = [];
            supervisoes = [];
            saveItems();
            saveSupervisoes();
            selectedOficinaForTodasVistorias = null;
            render();
            renderSupervisaoReport();
          }
        });
      }

      itemList.querySelectorAll('[data-oficina-btn-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedOficinaForTodasVistorias = btn.dataset.oficinaBtnId;
          selectedTodasVistoriasFilter = 'Vistorias';
          render();
        });
      });
      return;
    }

    // =========================================================================
    // CASO 4 (PADRÃO): EXIBIR TODAS AS VISTORIAS E SUPERVISÕES (Com Botão Exibir Oficinas)
    // =========================================================================
    const isDateFiltered = selectedTodasVistoriasDateFilter !== 'Todas';
    const selectedDate = selectedTodasVistoriasDateFilter;
    const formattedDate = formatDateString(selectedDate);
    const weekdayName = getWeekdayFromDateString(selectedDate) || '';

    const filteredVistorias = isDateFiltered 
      ? items.filter(item => item.date === selectedDate)
      : items;

    const filteredSupervisoes = isDateFiltered
      ? supervisoes.filter(s => s.date === selectedDate)
      : supervisoes;

    let listToDisplay = [];
    if (selectedTodasVistoriasFilter === 'Vistorias') {
      listToDisplay = filteredVistorias.map(i => ({ ...i, isSupervisao: false }));
      listToDisplay.sort((a, b) => b.id.localeCompare(a.id));
    } else {
      listToDisplay = filteredSupervisoes.map(s => ({ ...s, isSupervisao: true }));
      listToDisplay.sort((a, b) => {
        const timeA = a.updatedAtTime || Number(a.id) || 0;
        const timeB = b.updatedAtTime || Number(b.id) || 0;
        return timeB - timeA;
      });
    }

    const dateLabelHtml = isDateFiltered
      ? `<span style="color: #2563eb; font-weight: 800; background: #eff6ff; padding: 2px 8px; border-radius: 6px; border: 1px solid #bfdbfe; font-size: 0.85rem;">${formattedDate} (${weekdayName})</span>`
      : `<span style="color: #64748b; font-weight: 700; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0; margin-left: 4px;">Todas as Datas</span>`;

    const headerHtml = `
      <li style="list-style: none; grid-column: 1 / -1; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; width: 100%; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; flex-wrap: wrap;">
          <button id="btnExibirOficinas" class="ghost-btn" style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; padding: 8px 14px; font-weight: 700; background: #eff6ff; color: #1e40af; border: 1.5px solid #93c5fd; border-radius: 10px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(37,99,235,0.1);">
            🏢 Exibir Oficinas (${oficinas.length})
          </button>
          <button id="tabClearAllButton" class="ghost-btn" style="font-size: 0.76rem; padding: 6px 12px; width: auto; font-weight: 700; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 999px; cursor: pointer;">
            🧹 Limpar Tudo
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; background: #f8fafc; padding: 10px 12px; border-radius: 12px; border: 1px solid #e2e8f0; width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.82rem; font-weight: 700; color: #1e293b;">📅 Filtrar por Data:</span>
              ${dateLabelHtml}
            </div>
            <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">Total: ${isDateFiltered ? (filteredVistorias.length + filteredSupervisoes.length) : totalAllRecords}</span>
          </div>
          <select id="todasVistoriasDateSelect" class="custom-select" style="width: 100%; padding: 8px 12px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-weight: 600; font-size: 0.85rem; background-color: #ffffff; color: #0f172a; cursor: pointer; outline: none;">
            <option value="Todas"${!isDateFiltered ? ' selected' : ''}>📅 Todas as Datas (${totalAllRecords})</option>
            ${allDates.map(d => {
              const counts = countRecordsForDate(d);
              const wd = getWeekdayFromDateString(d);
              return `<option value="${d}"${selectedDate === d ? ' selected' : ''}>📅 ${formatDateString(d)} (${wd || ''}) - ${counts.total} registros</option>`;
            }).join('')}
          </select>
        </div>

        <div class="tabs" style="display: flex; gap: 8px; width: 100%;">
          <button class="tab-btn ${selectedTodasVistoriasFilter === 'Vistorias' ? 'active' : ''}" type="button" id="toggleFilterVistorias" style="flex: 1; text-align: center; font-weight: 700; border-radius: 12px; padding: 12px 16px;">
            Vistorias (${filteredVistorias.length})
          </button>
          <button class="tab-btn ${selectedTodasVistoriasFilter === 'Supervisões' ? 'active' : ''}" type="button" id="toggleFilterSupervisoes" style="flex: 1; text-align: center; font-weight: 700; border-radius: 12px; padding: 12px 16px;">
            Supervisões (${filteredSupervisoes.length})
          </button>
        </div>
      </li>
    `;

    const itemsHtml = listToDisplay.map(renderVistoriaOrSupervisaoCard).join('');
    itemList.innerHTML = headerHtml + (listToDisplay.length ? itemsHtml : `<li class="empty">Nenhum registro de ${selectedTodasVistoriasFilter.toLowerCase()} encontrado${isDateFiltered ? ' para a data ' + formattedDate : ''}.</li>`);

    const btnExibir = itemList.querySelector('#btnExibirOficinas');
    if (btnExibir) {
      btnExibir.addEventListener('click', () => {
        showOficinasInTodasVistorias = true;
        render();
      });
    }

    const dateSelect = itemList.querySelector('#todasVistoriasDateSelect');
    if (dateSelect) {
      dateSelect.addEventListener('change', (e) => {
        selectedTodasVistoriasDateFilter = e.target.value;
        render();
      });
    }

    const clearAllBtn = itemList.querySelector('#tabClearAllButton');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        const verification = window.prompt(
          '⚠️ AVISO DE SEGURANÇA:\n\n' +
          'Esta ação irá apagar PERMANENTEMENTE todos os registros cadastrados (vistorias e supervisões) de todas as oficinas.\n' +
          'Esta ação não poderá ser desfeita.\n\n' +
          'Para confirmar que deseja prosseguir, digite a palavra APAGAR no campo abaixo:'
        );
        if (verification && verification.trim().toUpperCase() === 'APAGAR') {
          items = [];
          supervisoes = [];
          saveItems();
          saveSupervisoes();
          selectedOficinaForTodasVistorias = null;
          showOficinasInTodasVistorias = false;
          render();
          renderSupervisaoReport();
        }
      });
    }

    attachCardActionListeners();
    return;
  }

  // Normal day filtering for regular vistorias
  const vistoriaOficinaInput = document.getElementById('vistoriaOficinaComboboxInput');
  const vistoriaOficinaText = vistoriaOficinaInput ? vistoriaOficinaInput.value.trim().toLowerCase() : '';

  const filtered = items.filter((item) => {
    if (selectedVistoriaOficina && selectedVistoriaOficina !== 'Todas' && item.oficinaId !== selectedVistoriaOficina) {
      return false;
    }
    if (vistoriaOficinaText && selectedVistoriaOficina === 'Todas' && !vistoriaOficinaText.startsWith('🏢')) {
      const ofName = (item.oficinaName || '').toLowerCase();
      if (!ofName.includes(vistoriaOficinaText)) return false;
    }

    const isTotalWeek = selectedDay === 'Total da semana';
    const matchesQuery = `${item.date} ${item.day} ${item.plate} ${item.provider} ${item.oficinaName || ''}`.toLowerCase().includes(query);
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
  const vistoriasComValor = statsItems.filter(item => Number(item.value) > 0);
  const vistoriasExtras = statsItems.filter(item => !item.value || Number(item.value) <= 0 || isNaN(Number(item.value)));
  const totalValue = statsItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const uniqueDays = new Set(statsItems.map((item) => item.day)).size;
  const lastRecord = statsItems.length ? (statsItems[0].date ? formatDateString(statsItems[0].date) : (statsItems[0].createdAt || '—')) : '—';

  summaryGrid.innerHTML = `
    <article class="summary-item">
      <strong>${vistoriasComValor.length}</strong>
      <span>vistorias</span>
    </article>
    <article class="summary-item">
      <strong>${vistoriasExtras.length}</strong>
      <span>vistorias extras</span>
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
      <strong>${lastRecord}</strong>
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
    'Pós entrega': 'badge-pos',
    'Vistoria Rio log': 'badge-riolog'
  };

  itemList.innerHTML = filtered.map((item) => {
    const badgeClass = badgeClasses[item.type || 'Inicial'] || 'badge-inicial';
    const dataCriacao = item.date ? formatDateString(item.date) : (item.createdAt || '—');
    const dataAtualizacao = item.updatedAt || item.createdAt || '—';

    return `
      <li class="item-card compact-item-card">
        <div class="item-main-info">
          <div class="plate-badge compact-plate-badge clickable-plate-link" data-action="open-report" data-id="${item.id}" title="Clique para abrir o relatório" style="cursor: pointer;">
            <span class="plate-badge-text">🚗 ${escapeHtml(item.plate)}</span>
          </div>
          <div class="item-details">
            <strong class="item-provider">${escapeHtml(item.provider || 'Sem seguradora')}</strong>
            <span class="item-meta">· 📅 ${escapeHtml(dataCriacao)}</span>
            <strong class="item-value">· R$ ${escapeHtml(Number(item.value).toFixed(2).replace('.', ','))}</strong>
            <span class="${badgeClass}" style="margin-left: 6px;">
              ${escapeHtml(item.type || 'Inicial')}
            </span>
            ${item.oficinaName ? `<div class="item-meta" style="margin-top: 4px; color: var(--color-slate-700);">Oficina: <strong>${escapeHtml(item.oficinaName)}</strong></div>` : ''}
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 3px;">🕒 Atualizado: ${escapeHtml(dataAtualizacao)}</div>
          </div>
        </div>
        <div class="actions card-actions-grid">
          <div class="btn-row">
            <button class="action-btn" type="button" data-action="photos" data-id="${item.id}">📸 Fotos</button>
            <button class="action-btn" type="button" data-action="open-folder" data-id="${item.id}">📂 Pasta</button>
            <button class="action-btn" type="button" data-action="edit" data-id="${item.id}">Editar</button>
            <button class="action-btn" type="button" data-action="delete" data-id="${item.id}">Excluir</button>
          </div>
          <div class="btn-row" style="margin-top: 4px; display: flex; gap: 6px;">
            <button class="action-btn" type="button" data-action="parts" data-id="${item.id}" style="font-weight: 800; font-size: 0.82rem !important; padding: 10px 8px !important; background: #2563eb; color: #ffffff; border: none; border-radius: 10px; flex: 0.9; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
              🚗 Partes do Veículo
            </button>
            <button class="action-btn" type="button" data-action="share-whatsapp-sequence" data-id="${item.id}" style="font-weight: 800; font-size: 0.82rem !important; padding: 10px 8px !important; background: #16a34a; color: #ffffff; border: none; border-radius: 10px; flex: 1.1; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(22,163,74,0.2);">
              📲 Enviar Vistoria
            </button>
          </div>
        </div>
      </li>
    `;
  }).join('');

  itemList.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', (e) => {
      if (button.tagName.toLowerCase() === 'a' || button.classList.contains('clickable-plate-link')) {
        e.preventDefault();
      }
      handleAction(button.dataset.action, button.dataset.id);
    });
  });

  renderReport(filtered);
}

function renderReport(filteredItems) {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const totals = days.map((day) => {
    const itemsForDay = items.filter((item) => item.day === day && item.clearedFromWeek !== true);
    itemsForDay.sort((a, b) => a.id.localeCompare(b.id));

    const platesHtml = itemsForDay.length
      ? itemsForDay.map((item, index) => '<div style="padding: 3px 0; border-bottom: 1px dashed #cbd5e1; font-weight: 500;">' + (index + 1) + '. ' + escapeHtml(item.plate) + '</div>').join('')
      : '-';
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

  // Checklist helper: retorna apenas a opção selecionada
  const getCheckmark = (val) => {
    const v = (val || '').toLowerCase().trim();
    if (v === 'sim') return 'Sim';
    if (v === 'não' || v === 'nao') return 'Não';
    if (v === 'n/i') return 'N/I';
    return val || 'Não';
  };

  const radioVal = details.radio === 'Original' ? 'original' : (details.radioBrand || 'Outra');

  let sections = [];

  if (item.type === 'Incêndio') {
    sections.push(`Incêndio`);
    sections.push(`${item.plate || ''} - ${item.provider || 'Sem seguradora'} - ${item.oficinaName || 'Sem oficina'}`);
    
    let checklist = [];
    checklist.push(`VISTORIA REALIZADA EM: ${formattedDate}`);
    checklist.push(`REBOCADO?: ${getCheckmark(details.rebocado || 'Não', 'rebocado')}`);
    checklist.push(`VEICULO COM CHAVE?: ${getCheckmark(details.chaveVeiculo || 'N/I', 'chaveVeiculo')}`);
    checklist.push(`MOTOR FUNCIONA?: ${getCheckmark(details.motorFunciona || 'Não', 'motorFunciona')}`);
    checklist.push(`AR CONDICIONADO?: ${getCheckmark(details.arCondicionado || 'N/I', 'arCondicionado')}`);
    checklist.push(`VEICULO COM ESTEPE?: ${getCheckmark(details.estepe || 'Não', 'estepe')}`);
    checklist.push(`MACACO?: ${getCheckmark(details.macaco || 'Não', 'macaco')}`);
    checklist.push(`TRIÂNGULO ?: ${getCheckmark(details.triangulo || 'Não', 'triangulo')}`);
    checklist.push(`CHAVE DE RODA ?: ${getCheckmark(details.chaveRoda || 'Não', 'chaveRoda')}`);
    checklist.push(`RÁDIO / MARCA:${radioVal}`);
    checklist.push(`PARABRISA.: ${(details.parabrisa || 'Bom').toLowerCase()}`);
    checklist.push(`BATERIA / MARCA: ${details.bateria || ''}`);
    checklist.push(`NÚMERO DO MOTOR?: ${getCheckmark(details.numeroMotor || 'Sim', 'numeroMotor')}`);
    sections.push(checklist.join('\n'));

    let fireDetails = [];
    if (details.origemIncendio) fireDetails.push(`Ponto de Origem do Incêndio : ${details.origemIncendio}`);
    
    if (details.sistemaCombustivel) {
      const scVal = details.sistemaCombustivel;
      const scObs = (details.obsSistemaCombustivel || '').trim();
      fireDetails.push(`Avaliação do Sistema de Combustível e Fluidos : ${scVal}${scObs ? ` (${scObs})` : ''}`);
    }

    if (details.sistemaEletrico) {
      const seVal = details.sistemaEletrico;
      const seObs = (details.obsSistemaEletrico || '').trim();
      fireDetails.push(`Avaliação do Sistema Elétrico : ${seVal}${seObs ? ` (${seObs})` : ''}`);
    }

    if (details.residuosExtincao) {
      const resVal = details.residuosExtincao === 'Obs' ? 'Obs' : getCheckmark(details.residuosExtincao || 'Não', 'residuosExtincao');
      const resObs = (details.obsResiduosExtincao || '').trim();
      fireDetails.push(`Resíduos de Extinção do Incêndio : ${resVal}${resObs ? ` (${resObs})` : ''}`);
    }

    if (details.tanqueAfetado) {
      fireDetails.push(`Tanque de combustível foi afetado ?: ${getCheckmark(details.tanqueAfetado || 'Não', 'tanqueAfetado')}`);
    }

    if (fireDetails.length > 0) {
      sections.push(fireDetails.join('\n'));
    }

    const obsVal = details.obs || details.obsIncendio || '';
    if (obsVal) {
      sections.push(`Observações Complementares : ${obsVal}`);
    }
  } else if (item.type === 'Pós entrega') {
    sections.push(`${item.plate || ''} - ${item.provider || 'Sem seguradora'} - ${item.oficinaName || 'Sem oficina'}`);
    sections.push(`VISTORIA REALIZADA EM: ${formattedDate}`);

    const reclamacaoVal = (details.reclamacao || details.obs || details.conteudoLivre || '').trim();
    if (reclamacaoVal) {
      sections.push(`Reclamação\n${reclamacaoVal}`);
    } else {
      sections.push(`Reclamação`);
    }

    if (details.trocas && details.trocas.trim()) {
      sections.push(`Trocas\n${details.trocas.trim()}`);
    }

    if (details.reparos && details.reparos.trim()) {
      sections.push(`Reparos\n${details.reparos.trim()}`);
    }

    return sections.join('\n\n');
  } else {
    // Other survey types
    sections.push(`${item.plate || ''} - ${item.provider || 'Sem seguradora'} - ${item.oficinaName || 'Sem oficina'}`);
    
    let checklist = [];
    checklist.push(`VISTORIA REALIZADA EM: ${formattedDate}`);
    checklist.push(`REBOCADO?: ${getCheckmark(details.rebocado || 'Não', 'rebocado')}`);
    checklist.push(`VEICULO COM CHAVE?: ${getCheckmark(details.chaveVeiculo || 'N/I', 'chaveVeiculo')}`);
    checklist.push(`MOTOR FUNCIONA?: ${getCheckmark(details.motorFunciona || 'Não', 'motorFunciona')}`);
    if (item.type !== 'Moto') {
      checklist.push(`AR CONDICIONADO?: ${getCheckmark(details.arCondicionado || 'N/I', 'arCondicionado')}`);
    }
    
    if ('estepe' in details) {
      checklist.push(`VEICULO COM ESTEPE?: ${getCheckmark(details.estepe || 'Não', 'estepe')}`);
      checklist.push(`MACACO?: ${getCheckmark(details.macaco || 'Não', 'macaco')}`);
      checklist.push(`TRIÂNGULO ?: ${getCheckmark(details.triangulo || 'Não', 'triangulo')}`);
      checklist.push(`CHAVE DE RODA ?: ${getCheckmark(details.chaveRoda || 'Não', 'chaveRoda')}`);
      checklist.push(`RÁDIO / MARCA:${radioVal}`);
      checklist.push(`PARABRISA.: ${(details.parabrisa || 'Bom').toLowerCase()}`);
      checklist.push(`BATERIA / MARCA: ${details.bateria || ''}`);
      checklist.push(`NÚMERO DO MOTOR?: ${getCheckmark(details.numeroMotor || 'Sim', 'numeroMotor')}`);
    }

    if (item.type === 'Roubo Recuperado' && details.obsRoubo) {
      checklist.push(`Observações Roubo: ${details.obsRoubo}`);
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
    if (item.type === 'Complemento' && details.conteudoLivre) {
      checklist.push(`Conteúdo: ${details.conteudoLivre}`);
    }
    
    sections.push(checklist.join('\n'));

    const obsVal = details.obs || details.obsRoubo || details.obsIncendio || details.obsEnchente || '';
    if (obsVal) {
      sections.push(`Obs.: ${obsVal}`);
    }
  }

  if (item.type === 'Vistoria Rio log') {
    if (details.avarias) {
      sections.push(`Avarias\n${details.avarias}`);
    } else {
      sections.push(`Avarias`);
    }
  } else {
    // Universal fields (Trocas & Reparos)
    const trocasVal = (details.trocas || item.trocas || '').trim();
    if (trocasVal) {
      sections.push(`Trocas\n${trocasVal}`);
    }

    const reparosVal = (details.reparos || item.reparos || '').trim();
    if (reparosVal) {
      sections.push(`Reparos\n${reparosVal}`);
    }
  }

  return sections.join('\n\n');
}

function shareSurveyText(id) {
  const text = getSurveyText(id);
  if (!text) return;

  if (window.AndroidInterface && typeof window.AndroidInterface.shareText === 'function') {
    window.AndroidInterface.shareText('Compartilhamento de Vistoria', text);
  } else if (navigator.share) {
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

async function shareReportTextOnly(id) {
  const item = items.find(entry => entry.id === id) || supervisoes.find(s => s.id === id);
  if (!item) {
    alert('Registro não encontrado!');
    return;
  }
  const vehicleName = (item.plate || item.vehicle || '').trim();
  if (!vehicleName) {
    alert("Nome do veículo ou placa inválido!");
    return;
  }

  const isInspection = items.some(entry => entry.id === id);
  let reportText = isInspection ? getSurveyText(id) : formatSingleSupervisaoText(item);
  if (!reportText || !reportText.trim()) {
    reportText = `Vistoria do veículo: ${vehicleName}`;
  }

  if (window.AndroidInterface && typeof window.AndroidInterface.shareText === 'function') {
    window.AndroidInterface.shareText(`Relatório: ${vehicleName}`, reportText);
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Relatório: ' + vehicleName, text: reportText });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('navigator.share falhou:', err);
    }
  }

  copyTextToClipboard(reportText);
  try {
    const encodedText = encodeURIComponent(reportText);
    const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(waUrl, '_blank');
  } catch (e) {
    alert('Relatório copiado para a área de transferência!');
  }
}
window.shareReportTextOnly = shareReportTextOnly;

function handleAction(action, id) {
  if (action === 'open-report') {
    openReportModal(id);
    return;
  }
  if (action === 'open-folder') {
    openInspectionFolderForId(id);
    return;
  }
  if (action === 'photos') {
    openPhotoManagerForId(id);
    return;
  }
  if (action === 'parts') {
    openVehiclePartsForVistoriaId(id);
    return;
  }
  if (action === 'share-whatsapp-sequence' || action === 'share-whatsapp-all' || action === 'share-whatsapp' || action === 'share-vistoria' || action === 'share-text' || action === 'share-report-text') {
    shareVistoriaWhatsAppSequence(id);
    return;
  }
  if (action === 'share-whatsapp-text') {
    shareVistoriaWhatsApp(id, 'text');
    return;
  }
  if (action === 'share-whatsapp-media') {
    shareVistoriaWhatsApp(id, 'media');
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
  
  updateVistoriaFormTitle();
  
  // Render dynamic fields before populating them
  renderDynamicSurveyFields();

  if (item.oficinaId) {
    const oficinaSelect = document.getElementById('itemOficinaSelect');
    if (oficinaSelect) oficinaSelect.value = item.oficinaId;
    const oficinaInput = document.getElementById('itemOficinaComboboxInput');
    const ofObj = oficinas.find(o => o.id === item.oficinaId);
    if (oficinaInput && ofObj) {
      oficinaInput.value = ofObj.name;
      const clearBtn = document.getElementById('itemOficinaComboboxClearBtn');
      if (clearBtn) clearBtn.style.display = 'block';
    }
  }

  if (item.details) {
    Object.keys(item.details).forEach((key) => {
      const input = dynamicFieldsContainer.querySelector(`[name="${key}"]`);
      if (input) {
        input.value = item.details[key];
        
        const container = input.id ? dynamicFieldsContainer.querySelector(`.type-buttons-container[data-input-id="${input.id}"]`) : null;
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

        if (container && container.dataset.obsId) {
          const obsInput = document.getElementById(container.dataset.obsId);
          if (obsInput) {
            obsInput.style.display = (item.details[key] === 'Obs' || (item.details[obsInput.name] && item.details[obsInput.name].trim())) ? 'block' : 'none';
          }
        }
      }
    });

    if (selectedType === 'Pós entrega') {
      const recInput = dynamicFieldsContainer.querySelector('[name="reclamacao"]');
      if (recInput && !recInput.value) {
        recInput.value = item.details.reclamacao || item.details.obs || item.details.conteudoLivre || '';
      }
    }
  }

  updateTypeButtonsHighlight();
  updateInsurerButtonsHighlight();
  updateFormState();

  const isWeekday = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].includes(selectedDay);
  if (!isWeekday) {
    selectedDay = item.day || 'Segunda';
    updateDayTabs();
    if (welcomeScreen) welcomeScreen.hidden = true;
    if (homeSummaryCard) homeSummaryCard.hidden = true;
    if (appHeader) appHeader.style.display = 'none';
    if (appContent) appContent.hidden = false;
  }

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
  if (selectedDay === 'Sábado') titleText = 'Sábado';
  else if (selectedDay === 'Seguradoras') titleText = 'Seguradoras';
  else if (selectedDay === 'Oficinas') titleText = 'Oficinas';
  else if (selectedDay === 'Total da semana') titleText = 'Total da Semana';
  else if (selectedDay === 'Todas as vistorias') titleText = 'Todas as Vistorias';
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

  updateVistoriaFormTitle();
  
  if (insurerForm) insurerForm.hidden = selectedDay !== 'Seguradoras';
  if (insurerCard) insurerCard.hidden = selectedDay !== 'Seguradoras';
  if (noInsurersNote) noInsurersNote.hidden = selectedDay !== 'Seguradoras';
  
  if (oficinaForm) oficinaForm.hidden = selectedDay !== 'Oficinas';
  if (oficinaCard) oficinaCard.hidden = selectedDay !== 'Oficinas';

  const isWeekday = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].includes(selectedDay);
  if (formCard) formCard.hidden = !isWeekday;
  if (recordsCard) recordsCard.hidden = !isWeekday && selectedDay !== 'Todas as vistorias';
  if (reportCard) reportCard.hidden = selectedDay !== 'Total da semana';
  
  if (vistoriaTypeTabsCard) {
    vistoriaTypeTabsCard.style.display = isWeekday ? 'block' : 'none';
  }
  
  if (supervisaoFormCard) supervisaoFormCard.hidden = selectedDay !== 'Supervisão';
  if (supervisaoRecordsCard) supervisaoRecordsCard.hidden = selectedDay !== 'Supervisão';

  if (clearWeekButton && clearMonthButton) {
    if (selectedDay === 'Todas as vistorias') {
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
    populateSupervisaoStageSelect();
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
  const arr = raw ? safeParseJson(raw, []) : [];
  return arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}

function saveOficinas() {
  oficinas.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  localStorage.setItem('web-system-oficinas-v1', JSON.stringify(oficinas));
}

function getResponsaveisFromForm() {
  if (!oficinaResponsaveisContainer) return [];
  const inputs = oficinaResponsaveisContainer.querySelectorAll('.oficina-responsavel-input');
  const responsaveis = [];
  inputs.forEach((input) => {
    const val = input.value.trim();
    if (val) responsaveis.push(val);
  });
  return responsaveis;
}

function addResponsavelRow(value) {
  if (!oficinaResponsaveisContainer) return;
  const row = document.createElement('div');
  row.className = 'responsavel-row';
  row.style.cssText = 'display: flex; gap: 6px; align-items: center; width: 100%;';
  row.innerHTML = `
    <input class="oficina-responsavel-input" type="text" placeholder="Nome do responsável" style="flex: 1; min-width: 0; width: 100%;" value="${value ? escapeHtml(value) : ''}" />
    <button type="button" class="remove-responsavel-btn" style="padding: 6px 10px; font-size: 0.85rem; color: #ef4444; border: 1px solid #fca5a5; border-radius: 8px; background: #fef2f2; min-width: auto; flex-shrink: 0; cursor: pointer;" onclick="this.parentElement.remove(); updateRemoveButtons()">✕</button>
  `;
  oficinaResponsaveisContainer.appendChild(row);
  const inp = row.querySelector('.oficina-responsavel-input');
  if (inp) inp.focus();
  updateRemoveButtonsVisibility();
}

window.updateRemoveButtons = function() {
  if (typeof updateRemoveButtonsVisibility === 'function') updateRemoveButtonsVisibility();
};

function updateRemoveButtonsVisibility() {
  if (!oficinaResponsaveisContainer) return;
  const rows = oficinaResponsaveisContainer.querySelectorAll('.responsavel-row');
  rows.forEach((row) => {
    const removeBtn = row.querySelector('.remove-responsavel-btn');
    if (removeBtn) {
      removeBtn.style.display = rows.length > 1 ? 'inline-block' : 'none';
    }
  });
}

function setResponsaveisForm(responsaveis) {
  if (!oficinaResponsaveisContainer) return;
  oficinaResponsaveisContainer.innerHTML = '';
  if (!responsaveis || responsaveis.length === 0) {
    addResponsavelRow('');
  } else {
    responsaveis.forEach((r) => addResponsavelRow(r));
  }
  updateRemoveButtonsVisibility();
}

function saveOficina(event) {
  event.preventDefault();

  const name = oficinaNameInput.value.trim();
  if (!name) return;

  const responsaveis = getResponsaveisFromForm();

  if (editingOficinaId) {
    oficinas = oficinas.map((oficina) => oficina.id === editingOficinaId ? { ...oficina, name, responsaveis } : oficina);
  } else {
    oficinas.push({
      id: Date.now().toString(),
      name,
      responsaveis
    });
  }

  saveOficinas();
  oficinaForm.reset();
  setResponsaveisForm([]);
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
  setResponsaveisForm([]);
  cancelOficinaEditButton.hidden = true;
}

function renderOficinas() {
  if (!oficinaList) return;

  oficinaList.innerHTML = oficinas.length
    ? oficinas.map((oficina) => {
      const responsaveisArr = oficina.responsaveis || [];
      const responsaveisHtml = responsaveisArr.length
        ? `<div style="margin-top: 4px; font-size: 0.8rem; color: #4b5563;">Responsáveis: ${responsaveisArr.map(r => escapeHtml(r)).join(', ')}</div>`
        : '<div style="margin-top: 4px; font-size: 0.8rem; color: #9ca3af; font-style: italic;">Nenhum responsável cadastrado</div>';
      return `
      <li class="item-card">
        <header>
          <div>
            <strong>${escapeHtml(oficina.name)}</strong>
            ${responsaveisHtml}
          </div>
          <div class="actions">
            <button class="action-btn" type="button" data-action="edit-oficina" data-id="${oficina.id}">Editar</button>
            <button class="action-btn" type="button" data-action="delete-oficina" data-id="${oficina.id}">Excluir</button>
          </div>
        </header>
      </li>
    `;
    }).join('')
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
  setResponsaveisForm(oficina.responsaveis || []);
  cancelOficinaEditButton.hidden = false;
  oficinaNameInput.focus();
}

function renderDynamicSurveyFields() {
  if (!dynamicFieldsContainer) return;

  const officeDropdownHtml = `
    <div style="width: 100%; max-width: 100%; box-sizing: border-box; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 4px;">
        <span style="font-size: 0.9rem; font-weight: 600; color: #374151;">🏢 Oficina</span>
        <a href="#" id="quickAddOficina" style="color: #2563eb; font-size: 0.8rem; font-weight: 700; text-decoration: none;">+ Cadastrar Nova</a>
      </div>
      
      <!-- Select nativo em segundo plano para manter integridade de submit e required -->
      <select id="itemOficinaSelect" name="oficinaId" required style="position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px; bottom: 0; left: 0;">
        <option value="" disabled selected>${oficinas.length ? 'Selecione a oficina...' : 'Nenhuma oficina cadastrada'}</option>
        ${oficinas.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('')}
      </select>

      <div class="oficina-combobox-wrapper" style="position: relative; width: 100%;">
        <div style="position: relative; display: flex; align-items: center; width: 100%;">
          <input id="itemOficinaComboboxInput" type="text" placeholder="${oficinas.length ? '🔍 Digite para buscar ou clique para selecionar...' : 'Nenhuma oficina cadastrada'}" autocomplete="off" style="width: 100% !important; box-sizing: border-box; padding: 11px 40px 11px 14px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-size: 0.90rem; font-weight: 600; outline: none; background: #ffffff; color: #0f172a; cursor: pointer;" />
          <button id="itemOficinaComboboxClearBtn" type="button" style="display: none; position: absolute; right: 28px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 1rem; color: #94a3b8; cursor: pointer; padding: 4px; line-height: 1;">✕</button>
          <button id="itemOficinaComboboxToggleBtn" type="button" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 0.8rem; color: #64748b; cursor: pointer; padding: 4px; line-height: 1;">▼</button>
        </div>
        <ul id="itemOficinaComboboxList" class="oficina-combobox-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; max-height: 220px; overflow-y: auto; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); z-index: 70; padding: 4px 0; margin: 0; list-style: none;"></ul>
      </div>
      ${!oficinas.length ? '<span style="color:#ef4444; font-size:0.75rem; margin-top:4px; display:block;">Cadastre uma oficina no menu antes de prosseguir.</span>' : ''}
    </div>
  `;

  let fieldsHtml = '';

  const commonChecklistHtml = `
    <div class="form-toggle-field">
      <span class="status-label">Rebocado?</span>
      <div class="type-buttons-container" data-input-id="input_rebocado">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
        <button type="button" class="type-btn" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_rebocado" name="rebocado" value="Não" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Veículo com chave?</span>
      <div class="type-buttons-container" data-input-id="input_chave_veiculo">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn" data-value="Não">Não</button>
        <button type="button" class="type-btn active" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_chave_veiculo" name="chaveVeiculo" value="N/I" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Motor funciona?</span>
      <div class="type-buttons-container" data-input-id="input_motor">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
        <button type="button" class="type-btn" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_motor" name="motorFunciona" value="Não" />
    </div>
  `;

  const arCondicionadoHtml = `
    <div class="form-toggle-field">
      <span class="status-label">Ar Condicionado?</span>
      <div class="type-buttons-container" data-input-id="input_ar_condicionado">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn" data-value="Não">Não</button>
        <button type="button" class="type-btn active" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_ar_condicionado" name="arCondicionado" value="N/I" />
    </div>
  `;

  const vehicleExtraChecklistHtml = `
    <div class="form-toggle-field">
      <span class="status-label">Veículo com estepe?</span>
      <div class="type-buttons-container" data-input-id="input_estepe">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
        <button type="button" class="type-btn" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_estepe" name="estepe" value="Não" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Macaco?</span>
      <div class="type-buttons-container" data-input-id="input_macaco">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
        <button type="button" class="type-btn" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_macaco" name="macaco" value="Não" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Triângulo?</span>
      <div class="type-buttons-container" data-input-id="input_triangulo">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
        <button type="button" class="type-btn" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_triangulo" name="triangulo" value="Não" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Chave de roda?</span>
      <div class="type-buttons-container" data-input-id="input_chave">
        <button type="button" class="type-btn" data-value="Sim">Sim</button>
        <button type="button" class="type-btn active" data-value="Não">Não</button>
        <button type="button" class="type-btn" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_chave" name="chaveRoda" value="Não" />
    </div>

    <div class="form-toggle-field" style="grid-column: 1 / -1;">
      <span class="status-label">Rádio / Marca</span>
      <div class="type-buttons-container radio-toggle" data-input-id="input_radio" style="margin-bottom: 8px;">
        <button type="button" class="type-btn active" data-value="Original">Original</button>
        <button type="button" class="type-btn" data-value="Outra">Outra</button>
        <button type="button" class="type-btn" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_radio" name="radio" value="Original" />
      <input type="text" id="input_radio_brand" name="radioBrand" placeholder="Digite a marca do rádio" style="display: none;" />
    </div>

    <div class="form-toggle-field">
      <span class="status-label">Parabrisa</span>
      <div class="type-buttons-container" data-input-id="input_parabrisa">
        <button type="button" class="type-btn active" data-value="Bom">Bom</button>
        <button type="button" class="type-btn" data-value="Ruim">Ruim</button>
        <button type="button" class="type-btn" data-value="N/I">N/I</button>
      </div>
      <input type="hidden" id="input_parabrisa" name="parabrisa" value="Bom" />
    </div>

    <label>
      Bateria / Marca
      <input type="text" name="bateria" placeholder="Marca da bateria" />
    </label>

    <div class="form-toggle-field" style="grid-column: 1 / -1;">
      <span class="status-label">Número do Motor?</span>
      <div class="type-buttons-container" data-input-id="input_numero_motor">
        <button type="button" class="type-btn active" data-value="Sim">Sim</button>
        <button type="button" class="type-btn" data-value="Não">Não</button>
      </div>
      <input type="hidden" id="input_numero_motor" name="numeroMotor" value="Sim" />
    </div>
  `;

  const obsHtml = `
    <label style="grid-column: 1 / -1;">
      Observações (Obs.)
      <textarea name="obs" rows="3" placeholder="Ex: tinta tricoat"></textarea>
    </label>
  `;

  const extraFieldsHtml = obsHtml;

  if (selectedType === 'Inicial') {
    fieldsHtml = commonChecklistHtml + arCondicionadoHtml + vehicleExtraChecklistHtml + extraFieldsHtml;
  } else if (selectedType === 'Moto') {
    fieldsHtml = commonChecklistHtml + extraFieldsHtml;
  } else if (selectedType === 'Roubo Recuperado') {
    fieldsHtml = commonChecklistHtml + arCondicionadoHtml + vehicleExtraChecklistHtml + extraFieldsHtml;
  } else if (selectedType === 'Incêndio') {
    fieldsHtml = commonChecklistHtml + arCondicionadoHtml + vehicleExtraChecklistHtml + `
      <label style="grid-column: 1 / -1;">
        Ponto de Origem do Incêndio
        <input type="text" name="origemIncendio" placeholder="Ex: Compartimento do motor" />
      </label>
      
      <div class="form-toggle-field" style="grid-column: 1 / -1;">
        <span class="status-label">Avaliação do Sistema de Combustível e Fluidos</span>
        <div class="type-buttons-container inc-toggle-obs" data-input-id="input_sistema_combustivel" data-obs-id="input_obs_sistema_combustivel">
          <button type="button" class="type-btn active" data-value="Ok">Ok</button>
          <button type="button" class="type-btn" data-value="Parcialmente Avariado">Parcialmente Avariado</button>
          <button type="button" class="type-btn" data-value="Totalmente Avariado">Totalmente Avariado</button>
          <button type="button" class="type-btn" data-value="Obs">Obs</button>
        </div>
        <input type="hidden" id="input_sistema_combustivel" name="sistemaCombustivel" value="Ok" />
        <input type="text" id="input_obs_sistema_combustivel" name="obsSistemaCombustivel" placeholder="Digite a observação do sistema de combustível..." style="display: none; margin-top: 6px; width: 100%; box-sizing: border-box;" />
      </div>

      <div class="form-toggle-field" style="grid-column: 1 / -1;">
        <span class="status-label">Avaliação do Sistema Elétrico</span>
        <div class="type-buttons-container inc-toggle-obs" data-input-id="input_sistema_eletrico" data-obs-id="input_obs_sistema_eletrico">
          <button type="button" class="type-btn active" data-value="Ok">Ok</button>
          <button type="button" class="type-btn" data-value="Parcialmente Avariado">Parcialmente Avariado</button>
          <button type="button" class="type-btn" data-value="Totalmente Avariado">Totalmente Avariado</button>
          <button type="button" class="type-btn" data-value="Obs">Obs</button>
        </div>
        <input type="hidden" id="input_sistema_eletrico" name="sistemaEletrico" value="Ok" />
        <input type="text" id="input_obs_sistema_eletrico" name="obsSistemaEletrico" placeholder="Digite a observação do sistema elétrico..." style="display: none; margin-top: 6px; width: 100%; box-sizing: border-box;" />
      </div>

      <div class="form-toggle-field" style="grid-column: 1 / -1;">
        <span class="status-label">Resíduos de Extinção do Incêndio?</span>
        <div class="type-buttons-container inc-toggle-obs" data-input-id="input_residuos" data-obs-id="input_obs_residuos">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
          <button type="button" class="type-btn" data-value="Obs">Obs</button>
        </div>
        <input type="hidden" id="input_residuos" name="residuosExtincao" value="Não" />
        <input type="text" id="input_obs_residuos" name="obsResiduosExtincao" placeholder="Digite a observação dos resíduos de extinção..." style="display: none; margin-top: 6px; width: 100%; box-sizing: border-box;" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Tanque de combustível foi afetado?</span>
        <div class="type-buttons-container" data-input-id="input_tanque">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
          <button type="button" class="type-btn" data-value="N/I">N/I</button>
        </div>
        <input type="hidden" id="input_tanque" name="tanqueAfetado" value="Não" />
      </div>
    ` + extraFieldsHtml;
  } else if (selectedType === 'Enchente') {
    fieldsHtml = commonChecklistHtml + arCondicionadoHtml + vehicleExtraChecklistHtml + `
      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água no óleo do motor?</span>
        <div class="type-buttons-container" data-input-id="input_oleo">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
          <button type="button" class="type-btn" data-value="N/I">N/I</button>
        </div>
        <input type="hidden" id="input_oleo" name="aguaOleo" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água nas velas?</span>
        <div class="type-buttons-container" data-input-id="input_velas">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
          <button type="button" class="type-btn" data-value="N/I">N/I</button>
        </div>
        <input type="hidden" id="input_velas" name="aguaVelas" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água nos faróis?</span>
        <div class="type-buttons-container" data-input-id="input_farois">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
          <button type="button" class="type-btn" data-value="N/I">N/I</button>
        </div>
        <input type="hidden" id="input_farois" name="aguaFarois" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água nas lanternas?</span>
        <div class="type-buttons-container" data-input-id="input_lanternas">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
          <button type="button" class="type-btn" data-value="N/I">N/I</button>
        </div>
        <input type="hidden" id="input_lanternas" name="aguaLanternas" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Vestígios de água no filtro?</span>
        <div class="type-buttons-container" data-input-id="input_filtro">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
          <button type="button" class="type-btn" data-value="N/I">N/I</button>
        </div>
        <input type="hidden" id="input_filtro" name="aguaFiltro" value="Não" />
      </div>

      <div class="form-toggle-field">
        <span class="status-label">Motor travado?</span>
        <div class="type-buttons-container" data-input-id="input_travado">
          <button type="button" class="type-btn" data-value="Sim">Sim</button>
          <button type="button" class="type-btn active" data-value="Não">Não</button>
          <button type="button" class="type-btn" data-value="N/I">N/I</button>
        </div>
        <input type="hidden" id="input_travado" name="motorTravado" value="Não" />
      </div>

      <label>
        Altura da água
        <input type="text" name="alturaAgua" placeholder="Ex: Acima dos bancos" />
      </label>
    ` + extraFieldsHtml;
  } else if (selectedType === 'Vistoria Rio log') {
    const avariasHtml = `
      <label style="grid-column: 1 / -1;">
        Avarias (uma por linha)
        <textarea name="avarias" rows="4" placeholder="Ex:&#10;Para-choque dianteiro avariado&#10;Farol LE quebrado"></textarea>
      </label>
    `;
    fieldsHtml = commonChecklistHtml + vehicleExtraChecklistHtml + obsHtml + avariasHtml;
  } else if (selectedType === 'Complemento') {
    fieldsHtml = `
      <label style="grid-column: 1 / -1;">
        Conteúdo do Relatório
        <textarea name="conteudoLivre" rows="5" required placeholder="Digite o conteúdo livre para o relatório..."></textarea>
      </label>
    ` + extraFieldsHtml;
  } else if (selectedType === 'Pós entrega') {
    const reclamacaoHtml = `
      <label style="grid-column: 1 / -1;">
        Reclamação
        <textarea name="reclamacao" rows="4" placeholder="Digite a reclamação..."></textarea>
      </label>
    `;
    fieldsHtml = reclamacaoHtml + obsHtml;
  }

  dynamicFieldsContainer.innerHTML = officeDropdownHtml + fieldsHtml;

  // Selecionar automaticamente a oficina "Rio Log" para "Vistoria Rio log"
  if (selectedType === 'Vistoria Rio log') {
    let rioLogOficina = oficinas.find(o => o.name.toLowerCase() === 'rio log');
    if (!rioLogOficina) {
      rioLogOficina = {
        id: Date.now().toString(),
        name: 'Rio Log'
      };
      oficinas.push(rioLogOficina);
      saveOficinas();
      renderOficinas();
      renderDynamicSurveyFields();
      return;
    }
    const selectEl = document.getElementById('itemOficinaSelect');
    if (selectEl) {
      selectEl.value = rioLogOficina.id;
      const inputEl = document.getElementById('itemOficinaComboboxInput');
      if (inputEl) inputEl.value = rioLogOficina.name;
      const clearBtn = document.getElementById('itemOficinaComboboxClearBtn');
      if (clearBtn) clearBtn.style.display = 'block';
    }
  }

  const quickAdd = dynamicFieldsContainer.querySelector('#quickAddOficina');
  if (quickAdd) {
    quickAdd.addEventListener('click', (e) => {
      e.preventDefault();
      openQuickAddOficinaModal('vistoria');
    });
  }

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

      if (container.dataset.obsId) {
        const obsInput = document.getElementById(container.dataset.obsId);
        if (obsInput) {
          obsInput.style.display = value === 'Obs' ? 'block' : 'none';
          if (value === 'Obs') {
            setTimeout(() => obsInput.focus(), 50);
          }
        }
      }

      // Custom rule 1: If motor doesn't work, set arCondicionado to "Não"
      if (inputId === 'input_motor' && value === 'Não') {
        const arInput = document.getElementById('input_ar_condicionado');
        if (arInput) {
          arInput.value = 'Não';
          const arContainer = dynamicFieldsContainer.querySelector('.type-buttons-container[data-input-id="input_ar_condicionado"]');
          if (arContainer) {
            arContainer.querySelectorAll('.type-btn').forEach((b) => {
              b.classList.toggle('active', b.dataset.value === 'Não');
            });
          }
        }
      }

      // Custom rule 2: If numeroMotor is "Não", add default text to obs field
      if (inputId === 'input_numero_motor') {
        const obsTextarea = dynamicFieldsContainer.querySelector('textarea[name="obs"]');
        if (obsTextarea) {
          const msg = "Número do motor Inacessível, devido a natureza do evento conforme mostra em vídeo enviado.";
          if (value === 'Não') {
            if (!obsTextarea.value.includes(msg)) {
              if (obsTextarea.value.trim() === '') {
                obsTextarea.value = msg;
              } else {
                obsTextarea.value += "\n" + msg;
              }
            }
          } else if (value === 'Sim') {
            obsTextarea.value = obsTextarea.value.replace(msg, "").replace(/\n+/g, "\n").trim();
          }
        }
      }
    });
  });

  // Initialize searchable combobox in the dynamic fields form
  setupItemFormOficinaCombobox();
}

let quickAddOficinaSource = 'vistoria';

function openQuickAddOficinaModal(source = 'vistoria') {
  quickAddOficinaSource = source;
  const modal = document.getElementById('quickAddOficinaModal');
  const nameInput = document.getElementById('quickAddOficinaNameInput');
  const respInput = document.getElementById('quickAddOficinaResponsavelInput');
  if (nameInput) nameInput.value = '';
  if (respInput) respInput.value = '';
  if (modal) modal.style.display = 'flex';
  if (nameInput) setTimeout(() => nameInput.focus(), 100);
}
window.openQuickAddOficinaModal = openQuickAddOficinaModal;

function closeQuickAddOficinaModal() {
  const modal = document.getElementById('quickAddOficinaModal');
  if (modal) modal.style.display = 'none';
}
window.closeQuickAddOficinaModal = closeQuickAddOficinaModal;

function handleQuickAddOficinaSubmit(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('quickAddOficinaNameInput');
  const respInput = document.getElementById('quickAddOficinaResponsavelInput');
  const name = nameInput ? nameInput.value.trim() : '';
  const resp = respInput ? respInput.value.trim() : '';

  if (!name) return;

  const exists = oficinas.some(o => o.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    alert('Esta oficina já está cadastrada!');
    return;
  }

  const newOficina = {
    id: Date.now().toString(),
    name: name,
    responsaveis: resp ? [resp] : []
  };

  oficinas.push(newOficina);
  saveOficinas();
  renderOficinas();
  closeQuickAddOficinaModal();

  if (quickAddOficinaSource === 'supervisao') {
    populateSupervisaoOficinaSelect();
    if (supervisaoOficinaSelect) {
      supervisaoOficinaSelect.value = newOficina.id;
    }
    const supInputEl = document.getElementById('supervisaoFormOficinaComboboxInput');
    const supClearBtn = document.getElementById('supervisaoFormOficinaComboboxClearBtn');
    if (supInputEl) supInputEl.value = newOficina.name;
    if (supClearBtn) supClearBtn.style.display = 'block';
    populateSupervisaoAttendedSelect();
    if (supervisaoAttendedInput && resp) {
      supervisaoAttendedInput.value = resp;
    }
  } else {
    renderDynamicSurveyFields();
    const selectEl = document.getElementById('itemOficinaSelect');
    const inputEl = document.getElementById('itemOficinaComboboxInput');
    const clearBtn = document.getElementById('itemOficinaComboboxClearBtn');
    if (selectEl) selectEl.value = newOficina.id;
    if (inputEl) inputEl.value = newOficina.name;
    if (clearBtn) clearBtn.style.display = 'block';
  }
}
window.handleQuickAddOficinaSubmit = handleQuickAddOficinaSubmit;

function setupItemFormOficinaCombobox() {
  const inputEl = document.getElementById('itemOficinaComboboxInput');
  const clearBtn = document.getElementById('itemOficinaComboboxClearBtn');
  const toggleBtn = document.getElementById('itemOficinaComboboxToggleBtn');
  const listEl = document.getElementById('itemOficinaComboboxList');
  const selectEl = document.getElementById('itemOficinaSelect');

  if (!inputEl || !listEl || !selectEl) return;

  function renderDropdown(filterText = '') {
    const q = filterText.trim().toLowerCase();
    const matchingOficinas = q
      ? oficinas.filter(o => o.name.toLowerCase().includes(q) || (o.responsaveis && o.responsaveis.some(r => r.toLowerCase().includes(q))))
      : oficinas;

    if (matchingOficinas.length === 0) {
      listEl.innerHTML = `<li style="padding: 12px 14px; font-size: 0.85rem; color: #94a3b8; text-align: center;">Nenhuma oficina encontrada</li>`;
    } else {
      listEl.innerHTML = matchingOficinas.map(oficina => {
        const isSel = selectEl.value === oficina.id;
        const respText = (oficina.responsaveis && oficina.responsaveis.length)
          ? `<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">👤 Resp: ${escapeHtml(oficina.responsaveis.join(', '))}</div>`
          : '';
        return `
          <li data-oficina-id="${oficina.id}" data-name="${escapeHtml(oficina.name)}" style="padding: 10px 14px; font-size: 0.88rem; font-weight: 600; color: ${isSel ? '#16a34a' : '#0f172a'}; cursor: pointer; border-bottom: 1px solid #f8fafc; background: ${isSel ? '#f0fdf4' : 'transparent'};">
            <div>${escapeHtml(oficina.name)}</div>
            ${respText}
          </li>
        `;
      }).join('');
    }
  }

  function openDropdown() {
    renderDropdown(inputEl.value);
    listEl.style.display = 'block';
  }

  function closeDropdown() {
    listEl.style.display = 'none';
  }

  function selectOficina(oficinaId, oficinaName) {
    selectEl.value = oficinaId;
    inputEl.value = oficinaName;
    if (clearBtn) clearBtn.style.display = 'block';
    closeDropdown();
  }

  if (selectEl.value) {
    const cur = oficinas.find(o => o.id === selectEl.value);
    if (cur) {
      inputEl.value = cur.name;
      if (clearBtn) clearBtn.style.display = 'block';
    }
  }

  inputEl.addEventListener('focus', () => {
    openDropdown();
  });

  inputEl.addEventListener('input', (e) => {
    const val = e.target.value;
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    renderDropdown(val);
    listEl.style.display = 'block';

    const matchExact = oficinas.find(o => o.name.toLowerCase() === val.trim().toLowerCase());
    if (matchExact) {
      selectEl.value = matchExact.id;
    } else {
      selectEl.value = '';
    }
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (listEl.style.display === 'block') {
        closeDropdown();
      } else {
        openDropdown();
        inputEl.focus();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectEl.value = '';
      inputEl.value = '';
      clearBtn.style.display = 'none';
      closeDropdown();
    });
  }

  listEl.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-oficina-id]');
    if (!li) return;
    selectOficina(li.dataset.oficinaId, li.dataset.name);
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
      closeDropdown();
    }
  });
}
window.setupItemFormOficinaCombobox = setupItemFormOficinaCombobox;

function setupSupervisaoFormOficinaCombobox() {
  const inputEl = document.getElementById('supervisaoFormOficinaComboboxInput');
  const clearBtn = document.getElementById('supervisaoFormOficinaComboboxClearBtn');
  const toggleBtn = document.getElementById('supervisaoFormOficinaComboboxToggleBtn');
  const listEl = document.getElementById('supervisaoFormOficinaComboboxList');
  const selectEl = document.getElementById('supervisaoOficinaSelect');

  if (!inputEl || !listEl || !selectEl) return;

  function renderDropdown(filterText = '') {
    const q = filterText.trim().toLowerCase();
    const matchingOficinas = q
      ? oficinas.filter(o => o.name.toLowerCase().includes(q) || (o.responsaveis && o.responsaveis.some(r => r.toLowerCase().includes(q))))
      : oficinas;

    if (matchingOficinas.length === 0) {
      listEl.innerHTML = `<li style="padding: 12px 14px; font-size: 0.85rem; color: #94a3b8; text-align: center;">Nenhuma oficina encontrada</li>`;
    } else {
      listEl.innerHTML = matchingOficinas.map(oficina => {
        const isSel = selectEl.value === oficina.id;
        const respText = (oficina.responsaveis && oficina.responsaveis.length)
          ? `<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">👤 Resp: ${escapeHtml(oficina.responsaveis.join(', '))}</div>`
          : '';
        return `
          <li data-oficina-id="${oficina.id}" data-name="${escapeHtml(oficina.name)}" style="padding: 10px 14px; font-size: 0.88rem; font-weight: 600; color: ${isSel ? '#16a34a' : '#0f172a'}; cursor: pointer; border-bottom: 1px solid #f8fafc; background: ${isSel ? '#f0fdf4' : 'transparent'};">
            <div>${escapeHtml(oficina.name)}</div>
            ${respText}
          </li>
        `;
      }).join('');
    }
  }

  function openDropdown() {
    renderDropdown(inputEl.value);
    listEl.style.display = 'block';
  }

  function closeDropdown() {
    listEl.style.display = 'none';
  }

  function selectOficina(oficinaId, oficinaName) {
    selectEl.value = oficinaId;
    inputEl.value = oficinaName;
    if (clearBtn) clearBtn.style.display = 'block';
    closeDropdown();
    populateSupervisaoAttendedSelect();
  }

  if (selectEl.value) {
    const cur = oficinas.find(o => o.id === selectEl.value);
    if (cur) {
      inputEl.value = cur.name;
      if (clearBtn) clearBtn.style.display = 'block';
    }
  }

  inputEl.addEventListener('focus', () => {
    openDropdown();
  });

  inputEl.addEventListener('input', (e) => {
    const val = e.target.value;
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    renderDropdown(val);
    listEl.style.display = 'block';

    const matchExact = oficinas.find(o => o.name.toLowerCase() === val.trim().toLowerCase());
    if (matchExact) {
      selectEl.value = matchExact.id;
    } else {
      selectEl.value = '';
    }
    populateSupervisaoAttendedSelect();
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (listEl.style.display === 'block') {
        closeDropdown();
      } else {
        openDropdown();
        inputEl.focus();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectEl.value = '';
      inputEl.value = '';
      clearBtn.style.display = 'none';
      closeDropdown();
      populateSupervisaoAttendedSelect();
    });
  }

  listEl.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-oficina-id]');
    if (!li) return;
    selectOficina(li.dataset.oficinaId, li.dataset.name);
  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
      closeDropdown();
    }
  });
}
window.setupSupervisaoFormOficinaCombobox = setupSupervisaoFormOficinaCombobox;

function populateSupervisaoOficinaSelect() {
  if (!supervisaoOficinaSelect) return;
  const currentVal = supervisaoOficinaSelect.value;
  const options = oficinas.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
  supervisaoOficinaSelect.innerHTML = `<option value="" disabled selected>${oficinas.length ? 'Selecione a oficina...' : 'Nenhuma oficina cadastrada'}</option>` + options;
  if (currentVal && oficinas.some(o => o.id === currentVal)) {
    supervisaoOficinaSelect.value = currentVal;
  }
  const supInputEl = document.getElementById('supervisaoFormOficinaComboboxInput');
  const supClearBtn = document.getElementById('supervisaoFormOficinaComboboxClearBtn');
  if (supInputEl) {
    const cur = oficinas.find(o => o.id === supervisaoOficinaSelect.value);
    supInputEl.value = cur ? cur.name : '';
    if (supClearBtn) supClearBtn.style.display = cur ? 'block' : 'none';
  }
  populateSupervisaoAttendedSelect();
}

function populateSupervisaoAttendedSelect(preserveValue) {
  if (!supervisaoAttendedInput) return;
  const readonlyInput = document.getElementById('supervisaoAttendedReadonly');
  const oficinaId = supervisaoOficinaSelect ? supervisaoOficinaSelect.value : '';
  const selectedOficina = oficinas.find(o => o.id === oficinaId);
  const responsaveis = selectedOficina ? (selectedOficina.responsaveis || []) : [];
  const currentVal = preserveValue || supervisaoAttendedInput.value;

  // === 1 responsavel: preenche automaticamente, sem select ===
  if (responsaveis.length === 1) {
    supervisaoAttendedInput.style.display = 'none';
    supervisaoAttendedInput.removeAttribute('required');
    if (readonlyInput) {
      readonlyInput.style.display = '';
      readonlyInput.value = responsaveis[0];
    }
    return;
  }

  // === 2+ responsaveis ou nenhum: exibe o select ===
  supervisaoAttendedInput.style.display = '';
  supervisaoAttendedInput.setAttribute('required', '');
  if (readonlyInput) {
    readonlyInput.style.display = 'none';
    readonlyInput.value = '';
  }

  if (responsaveis.length > 1) {
    const options = responsaveis.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    supervisaoAttendedInput.innerHTML = `<option value="" disabled selected>Selecione o responsável...</option>` + options + `<option value="__outro__">Outro (digitar)</option>`;
    if (currentVal && responsaveis.includes(currentVal)) {
      supervisaoAttendedInput.value = currentVal;
    } else if (currentVal && currentVal !== '' && currentVal !== '__outro__') {
      supervisaoAttendedInput.innerHTML = `<option value="" disabled>Selecione o responsável...</option>` + `<option value="${escapeHtml(currentVal)}" selected>${escapeHtml(currentVal)}</option>` + options + `<option value="__outro__">Outro (digitar)</option>`;
    }
  } else {
    // Nenhum responsavel cadastrado
    supervisaoAttendedInput.innerHTML = `<option value="" disabled selected>${oficinaId ? 'Nenhum responsável cadastrado' : 'Selecione a oficina primeiro...'}</option><option value="__outro__">Outro (digitar)</option>`;
  }

  // Handle "Outro" option: prompt for free text
  supervisaoAttendedInput.onchange = function() {
    if (supervisaoAttendedInput.value === '__outro__') {
      const customName = window.prompt('Digite o nome de quem atendeu:');
      if (customName && customName.trim()) {
        const trimmed = customName.trim();
        const opt = document.createElement('option');
        opt.value = trimmed;
        opt.textContent = trimmed;
        opt.selected = true;
        supervisaoAttendedInput.insertBefore(opt, supervisaoAttendedInput.querySelector('option[value="__outro__"]'));
      } else {
        supervisaoAttendedInput.value = '';
      }
    }
  };
}

function populateSupervisaoOficinaFilter() {
  // O combobox unificado de oficina renderiza e gerencia a lista dinamicamente
}

function populateSupervisaoStageSelect() {
  if (!supervisaoStageInput) return;
  const currentVal = supervisaoStageInput.value;
  const options = stages.map(st => `<option value="${st}">${escapeHtml(st)}</option>`).join('');
  supervisaoStageInput.innerHTML = `<option value="" disabled selected>Selecione a etapa...</option>` + options;
  if (currentVal && stages.includes(currentVal)) {
    supervisaoStageInput.value = currentVal;
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

async function startSync() {
  await loadServerData();
  if (syncIntervalId) return;
  syncIntervalId = setInterval(loadServerData, SYNC_POLL_MS);
}

async function loadServerData() {
  try {
    const response = await fetch('/api/data', { cache: 'no-store' });
    if (!response.ok) throw new Error('Servidor local não disponível');
    const data = await response.json();
    if (Array.isArray(data.items) && Array.isArray(data.insurers)) {
      items = data.items;
      insurers = data.insurers;
      saveItems();
      saveInsurers();
      serverSync = true;
      updateSyncStatus('Sincronizado com servidor local');
      render();
      renderInsurers();
      populateProviderSelect();
      return;
    }
    throw new Error('Dados do servidor inválidos');
  } catch (error) {
    serverSync = false;
    updateSyncStatus('Serviço local indisponível; usando dados locais');
  }
}

async function syncDataToServer() {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, insurers })
    });
    updateSyncStatus('Dados enviados para servidor local');
  } catch (error) {
    serverSync = false;
    updateSyncStatus('Falha na sincronização local');
  }
}

function formatDateForDisplay(dateStr) {
  return formatDateString(dateStr);
}

function getTodayDateValue() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekdayFromDateString(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month, day);
      const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      return weekdayNames[d.getDay()];
    }
  }
  return null;
}

function getWeekdayName(date) {
  if (!date) date = new Date();
  const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return weekdayNames[date.getDay()];
}

function getSelectedSaveDay(targetDateStr) {
  const dateStr = targetDateStr || getTodayDateValue();
  const realDay = getWeekdayFromDateString(dateStr);
  const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  if (selectedDay && weekdays.includes(selectedDay)) {
    return selectedDay;
  }
  return realDay || getWeekdayName(new Date());
}

function formatDateString(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
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

function autoFixItemDays(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  let changed = false;
  const fixed = rawItems.map(item => {
    if (item.date) {
      const realDay = getWeekdayFromDateString(item.date);
      if (realDay && realDay !== item.day) {
        changed = true;
        return { ...item, day: realDay };
      }
    }
    return item;
  });
  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fixed));
    } catch(e) {}
  }
  return fixed;
}

function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParseJson(raw, []) : [];
  return autoFixItemDays(parsed);
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
  if (vistoriaTypeTabs) {
    vistoriaTypeTabs.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.type === (selectedType || 'Inicial'));
    });
  }
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
  // Lê do campo correto: readonly (1 responsavel) ou select (2+ ou nenhum)
  const readonlyAttended = document.getElementById('supervisaoAttendedReadonly');
  const attended = (readonlyAttended && readonlyAttended.style.display !== 'none')
    ? readonlyAttended.value.trim()
    : supervisaoAttendedInput.value.trim();
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
      ...s, 
      date: getTodayDateValue(),
      day: getWeekdayName(new Date()),
      vehicle, plate, attended, stage, partsPending, parts, arrival, other, finish, oficinaId, oficinaName,
      updatedAt: new Date().toLocaleString('pt-BR'),
      updatedAtTime: Date.now()
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
      createdAt: new Date().toLocaleString('pt-BR'),
      updatedAt: new Date().toLocaleString('pt-BR'),
      updatedAtTime: Date.now()
    });
  }

  saveSupervisoes();
  supervisaoForm.reset();
  const supOficinaInput = document.getElementById('supervisaoFormOficinaComboboxInput');
  const supOficinaClearBtn = document.getElementById('supervisaoFormOficinaComboboxClearBtn');
  if (supOficinaInput) supOficinaInput.value = '';
  if (supOficinaClearBtn) supOficinaClearBtn.style.display = 'none';
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
  const supOficinaInput = document.getElementById('supervisaoFormOficinaComboboxInput');
  const supOficinaClearBtn = document.getElementById('supervisaoFormOficinaComboboxClearBtn');
  if (supOficinaInput) supOficinaInput.value = '';
  if (supOficinaClearBtn) supOficinaClearBtn.style.display = 'none';
  populateSupervisaoAttendedSelect();
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

  const searchInputEl = document.getElementById('supervisaoOficinaComboboxInput');
  const searchText = searchInputEl ? searchInputEl.value.trim().toLowerCase() : '';

  const filtered = supervisoes.filter((s) => {
    if (selectedSupervisaoOficina !== 'Todas' && s.oficinaId !== selectedSupervisaoOficina) return false;
    if (searchText && selectedSupervisaoOficina === 'Todas' && !searchText.startsWith('🏢')) {
      const ofObj = oficinas.find(o => o.id === s.oficinaId);
      const ofName = (ofObj ? ofObj.name : (s.oficinaName || '')).toLowerCase();
      if (!ofName.includes(searchText)) return false;
    }
    return true;
  });

  const countEl = document.getElementById('supervisaoOficinaFilterCount');
  if (countEl) {
    countEl.textContent = `Total: ${filtered.length}`;
  }

  if (!filtered.length) {
    supervisaoReportContent.innerHTML = '<tr><td colspan="7" class="empty">Nenhum registro de supervisão encontrado.</td></tr>';
    return;
  }

  // Sort by updated time descending
  filtered.sort((a, b) => {
    const timeA = a.updatedAtTime || Number(a.id) || 0;
    const timeB = b.updatedAtTime || Number(b.id) || 0;
    return timeB - timeA;
  });

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

    const dataUnica = s.updatedAt || s.createdAt || (s.date ? formatDateString(s.date) : '—');

    return `
      <tr>
        <td data-label="Veículo" style="font-weight: 600;">
          <div class="plate-badge compact-plate-badge clickable-plate-link" data-super-action="open-report" data-id="${s.id}" title="Clique para abrir o relatório" style="cursor: pointer; display: inline-flex; margin-bottom: 4px;">
            <span class="plate-badge-text">🚗 ${escapeHtml(s.vehicle || s.plate || 'Supervisão')}</span>
          </div>
          <div style="font-size: 0.72rem; color: #64748b; font-weight: normal; margin-top: 2px;">
            🕒 ${escapeHtml(dataUnica)}
          </div>
        </td>
        <td data-label="Oficina" style="font-weight: 500;">${escapeHtml(s.oficinaName || 'Sem oficina')}</td>
        <td data-label="Atendido por">${escapeHtml(s.attended)}</td>
        <td data-label="Status">
          <span class="${stageClass}">${escapeHtml(s.stage)}</span>
        </td>
        <td data-label="Pendência Peças">${partsPendingHtml}</td>
        <td data-label="Previsão/Estimativa">${prevEst}</td>
        <td data-label="Ações">
          <div class="actions card-actions-grid">
            <div class="btn-row">
              <button class="action-btn" type="button" data-super-action="photos" data-id="${s.id}">📸 Fotos</button>
              <button class="action-btn" type="button" data-super-action="open-folder" data-id="${s.id}">📂 Pasta</button>
              <button class="action-btn" type="button" data-super-action="edit" data-id="${s.id}">Editar</button>
              <button class="action-btn" type="button" data-super-action="delete" data-id="${s.id}">Excluir</button>
            </div>
            <div class="btn-row" style="margin-top: 4px; display: flex; gap: 6px;">
              <button class="action-btn" type="button" data-super-action="share-whatsapp-sequence" data-id="${s.id}" style="font-weight: 800; font-size: 0.82rem !important; padding: 10px 8px !important; background: #16a34a; color: #ffffff; border: none; border-radius: 10px; flex: 2; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(22,163,74,0.2);">
                📲 Compartilhar (Texto + Fotos)
              </button>
              <button class="action-btn" type="button" data-super-action="share-whatsapp-text" data-id="${s.id}" style="font-weight: 700; font-size: 0.80rem !important; padding: 10px 6px !important; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 10px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;">
                💬 Só Texto
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  supervisaoReportContent.querySelectorAll('[data-super-action]').forEach((button) => {
    button.addEventListener('click', (e) => {
      if (button.tagName.toLowerCase() === 'a') {
        e.preventDefault();
      }
      handleSupervisaoAction(button.dataset.superAction, button.dataset.id);
    });
  });
}

function handleSupervisaoAction(action, id) {
  if (action === 'open-report') {
    openReportModal(id);
    return;
  }
  if (action === 'open-folder') {
    openInspectionFolderForId(id);
    return;
  }
  if (action === 'share-whatsapp-sequence' || action === 'share-whatsapp-all' || action === 'share-whatsapp' || action === 'share-vistoria' || action === 'share-report-text') {
    shareVistoriaWhatsAppSequence(id);
    return;
  }
  if (action === 'share-whatsapp-text') {
    shareVistoriaWhatsApp(id, 'text');
    return;
  }
  if (action === 'share-whatsapp-media' || action === 'share-photos') {
    shareVistoriaWhatsApp(id, 'media');
    return;
  }
  if (action === 'photos') {
    openPhotoManagerForId(id);
    return;
  }
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

  if (selectedDay !== 'Supervisão') {
    selectedDay = 'Supervisão';
    updateDayTabs();
    if (welcomeScreen) welcomeScreen.hidden = true;
    if (homeSummaryCard) homeSummaryCard.hidden = true;
    if (appContent) appContent.hidden = false;
  }

  // Ensure select options are generated in the DOM
  populateSupervisaoOficinaSelect();
  populateSupervisaoStageSelect();

  editingSupervisaoId = s.id;
  supervisaoVehicleInput.value = s.vehicle || '';
  if (supervisaoOficinaSelect) supervisaoOficinaSelect.value = s.oficinaId || '';
  const supOficinaInput = document.getElementById('supervisaoFormOficinaComboboxInput');
  const supOficinaClearBtn = document.getElementById('supervisaoFormOficinaComboboxClearBtn');
  const curOficina = oficinas.find(o => o.id === s.oficinaId);
  if (supOficinaInput) supOficinaInput.value = curOficina ? curOficina.name : (s.oficinaName || '');
  if (supOficinaClearBtn) supOficinaClearBtn.style.display = (s.oficinaId || s.oficinaName) ? 'block' : 'none';
  populateSupervisaoAttendedSelect(s.attended || '');
  if (supervisaoAttendedInput) supervisaoAttendedInput.value = s.attended || '';
  if (supervisaoStageInput) supervisaoStageInput.value = s.stage || '';
  
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
    const partsPendingText = isPending ? 'Sim' : 'Não';
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

  if (details.length > 0) {
    sections.push(details.join('\n'));
  }

  if (s.finish && s.finish.trim()) {
    sections.push(`Estimativa de finalização do veículo?: ${s.finish.trim()}`);
  }

  return sections.join('\n\n');
}

function getFilteredSupervisoes() {
  const filtered = supervisoes.filter((s) => {
    if (selectedSupervisaoStage !== 'Todos' && s.stage !== selectedSupervisaoStage) return false;
    if (selectedSupervisaoOficina !== 'Todas' && s.oficinaId !== selectedSupervisaoOficina) return false;
    return true;
  });
  filtered.sort((a, b) => {
    const timeA = a.updatedAtTime || Number(a.id) || 0;
    const timeB = b.updatedAtTime || Number(b.id) || 0;
    return timeB - timeA;
  });
  return filtered;
}

function formatAllSupervisoesText(filteredList) {
  if (!filteredList || filteredList.length === 0) {
    return 'Nenhum registro de supervisão encontrado.';
  }
  return filteredList.map((s) => formatSingleSupervisaoText(s)).join('\n\n----------------------------------------\n\n');
}

async function shareSupervisaoText(text, title = 'Relatório de Supervisão') {
  if (window.AndroidInterface && typeof window.AndroidInterface.shareText === 'function') {
    window.AndroidInterface.shareText(title, text);
    return;
  }
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

  // Filter and sort items
  const filtered = getFilteredSupervisoes();

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
    if (window.AndroidInterface && typeof window.AndroidInterface.sharePdf === 'function') {
      const base64Pdf = doc.output('datauristring').split(',')[1];
      window.AndroidInterface.sharePdf(filename, base64Pdf);
    } else {
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
    }
  } catch (error) {
    console.error('Falha ao compartilhar PDF:', error);
    if (!(window.AndroidInterface && typeof window.AndroidInterface.sharePdf === 'function')) {
      doc.save(filename);
    }
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
  doc.text("Gestão de Vistorias - Relatório Semanal", pageWidth / 2, 20, { align: "center" });

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

  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  
  let grandTotalVisits = 0;
  let grandTotalValue = 0;

  const tableRows = [];
  days.forEach((day) => {
    // Get items for this day
    const itemsForDay = items.filter((item) => item.day === day && item.clearedFromWeek !== true && (Number(item.value) || 0) > 0);
    
    // Only include day if there is at least one registry
    if (itemsForDay.length === 0) {
      return;
    }

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

    const dayDisplayName = day === 'Sábado' ? 'Sábado' : `${day}-feira`;

    tableRows.push([
      dayDisplayName,
      itemsForDay.length.toString(),
      numberedPlatesText,
      `R$ ${dayValue.toFixed(2).replace('.', ',')}`
    ]);
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
    if (window.AndroidInterface && typeof window.AndroidInterface.sharePdf === 'function') {
      const base64Pdf = doc.output('datauristring').split(',')[1];
      window.AndroidInterface.sharePdf(filename, base64Pdf);
    } else {
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
    }
  } catch (error) {
    console.error('Falha ao gerar/compartilhar PDF:', error);
    if (!(window.AndroidInterface && typeof window.AndroidInterface.sharePdf === 'function')) {
      doc.save(filename);
    }
  }
}


// ==========================================
// PHOTO SYSTEM IMPLEMENTATION
// ==========================================

let activePhotoVehicleName = ''; 
let activePhotoId = '';          
let db = null;
let dbRequest = null;
if (typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB) {
  try {
    dbRequest = window.indexedDB.open('PhotoSystemDB', 1);
    dbRequest.onupgradeneeded = function(e) {
      const localDb = e.target.result;
      if (!localDb.objectStoreNames.contains('directories')) {
        localDb.createObjectStore('directories');
      }
      if (!localDb.objectStoreNames.contains('photos')) {
        localDb.createObjectStore('photos', { keyPath: 'id' });
      }
    };
    dbRequest.onsuccess = function(e) {
      db = e.target.result;
      loadStoredDirectoryHandle();
      
      // Clear any leftovers on startup to prevent camera loop
      localStorage.removeItem('active_photo_id');
      localStorage.removeItem('active_photo_vehicle_name');
      localStorage.removeItem('waiting_camera_return');
    };
  } catch (err) {
    console.warn('indexedDB não disponível neste ambiente:', err);
  }
}

async function loadStoredDirectoryHandle() {
  if (!db) return;
  const tx = db.transaction('directories', 'readonly');
  const store = tx.objectStore('directories');
  const getReq = store.get('root_handle');
  getReq.onsuccess = async function() {
    if (getReq.result) {
      directoryHandle = getReq.result;
      console.log('Restored directory handle from IndexedDB');
      updateDesktopPathUI();
    }
  };
}

function saveDirectoryHandle(handle) {
  if (!db) return;
  const tx = db.transaction('directories', 'readwrite');
  const store = tx.objectStore('directories');
  store.put(handle, 'root_handle');
}

const systemSettingsModal = document.getElementById('systemSettingsModal');
const photoManagerModal = document.getElementById('photoManagerModal');
const selectDesktopDirButton = document.getElementById('selectDesktopDirButton');
const selectedDesktopPathLabel = document.getElementById('selectedDesktopPathLabel');
const closeSystemSettingsBtn = document.getElementById('closeSystemSettingsBtn');
const systemSettingsBtn = document.getElementById('systemSettingsBtn');
const selectStorageFolderBtn = document.getElementById('selectStorageFolderBtn');
const selectedFolderLabel = document.getElementById('selectedFolderLabel');
const capturePhotoButton = document.getElementById('capturePhotoButton');
const exportPhotosZipButton = document.getElementById('exportPhotosZipButton');
const openPhotoSettingsBtn = document.getElementById('openPhotoSettingsBtn');
const photoGridContainer = document.getElementById('photoGridContainer');
const closePhotoManagerButton = document.getElementById('closePhotoManagerButton');
const photoSystemFileInput = document.getElementById('photoSystemFileInput');
const photoSystemCameraInput = document.getElementById('photoSystemCameraInput');
const desktopDirPickerContainer = document.getElementById('desktopDirPickerContainer');

if ('showDirectoryPicker' in window) {
  if (desktopDirPickerContainer) desktopDirPickerContainer.style.display = 'block';
}

function updateDesktopPathUI() {
  if (selectedDesktopPathLabel && directoryHandle) {
    selectedDesktopPathLabel.textContent = `Pasta vinculada: ${directoryHandle.name}`;
  }
}

if (selectDesktopDirButton) {
  selectDesktopDirButton.addEventListener('click', async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      directoryHandle = handle;
      saveDirectoryHandle(handle);
      updateDesktopPathUI();
    } catch (err) {
      console.error('Directory picker cancelled or failed:', err);
    }
  });
}

function updateFolderLabelUI() {
  let friendlyName = localStorage.getItem('photo_folder_name_friendly');
  if (window.AndroidInterface && typeof window.AndroidInterface.getSelectedFolderName === 'function') {
    const androidFolder = window.AndroidInterface.getSelectedFolderName();
    if (androidFolder && androidFolder !== 'Pictures/Vistorias (Padrão)' && androidFolder !== 'Pasta Selecionada') {
      friendlyName = androidFolder;
      localStorage.setItem('photo_folder_name_friendly', androidFolder);
    }
  }
  if (selectedFolderLabel) {
    if (friendlyName && friendlyName !== 'Pictures/Vistorias (Padrão)' && friendlyName !== 'Pasta Selecionada') {
      selectedFolderLabel.textContent = `Pasta selecionada: ${friendlyName}`;
    } else {
      selectedFolderLabel.textContent = 'Pasta selecionada: Pictures/Vistorias (Padrão)';
    }
  }
}

function openSystemSettings() {
  const folderSection = document.getElementById('folderSettingsSection');
  if (folderSection) folderSection.style.setProperty('display', 'none', 'important');
  const cameraSection = document.getElementById('cameraSettingsSection');
  if (cameraSection) cameraSection.style.setProperty('display', 'none', 'important');

  const versionDisplay = document.getElementById('systemAppVersionDisplay') || document.getElementById('systemVersionText');
  if (versionDisplay) versionDisplay.textContent = CURRENT_APP_VERSION;
  const serverJsonEl = document.getElementById('serverVersionJsonDisplay');
  if (serverJsonEl) serverJsonEl.textContent = CURRENT_APP_VERSION;

  updateFolderLabelUI();
  updatePreferredCameraUI();
  if (systemSettingsModal) systemSettingsModal.style.display = 'flex';
  checkForSystemUpdates(false);
}

async function forceAppRefresh() {
  const btn = document.getElementById('forceRefreshAppBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Atualizando sistema...';
  }

  // 1. Limpa todos os caches locais do Service Worker
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch(e) {}
  }

  // 2. Desregistra Service Worker ativo para forçar download novo
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    } catch(e) {}
  }

  // 3. Notifica interface nativa do Android se disponível
  if (window.AndroidInterface && typeof window.AndroidInterface.clearAppCache === 'function') {
    try {
      window.AndroidInterface.clearAppCache();
    } catch(e) {}
  }

  // 4. Recarrega a página forçando bypass de cache
  setTimeout(() => {
    window.location.href = 'dashboard.html?t=' + Date.now() + '&v=' + CURRENT_APP_VERSION;
  }, 250);
}
window.forceAppRefresh = forceAppRefresh;

function updatePreferredCameraUI() {
  const preferredCameraLabel = document.getElementById('preferredCameraLabel');
  const clearCameraBtn = document.getElementById('clearCameraBtn');
  if (!preferredCameraLabel) return;

  let label = 'Nenhuma';
  const saved = localStorage.getItem('preferred_camera_label');

  if (window.AndroidInterface && typeof window.AndroidInterface.getPreferredCameraLabel === 'function') {
    const androidLabel = window.AndroidInterface.getPreferredCameraLabel();
    if (androidLabel && androidLabel !== 'Nenhuma') {
      label = androidLabel;
      localStorage.setItem('preferred_camera_label', androidLabel);
    } else if (saved && saved !== 'Nenhuma') {
      label = saved;
    }
  } else {
    if (saved) label = saved;
  }

  preferredCameraLabel.textContent = "Câmera preferida: " + label;
  preferredCameraLabel.style.display = 'none';
  if (clearCameraBtn) {
    clearCameraBtn.style.display = 'none';
  }
}

const selectCameraBtn = document.getElementById('selectCameraBtn');
if (selectCameraBtn) {
  selectCameraBtn.addEventListener('click', () => {
    if (window.AndroidInterface && typeof window.AndroidInterface.selectPreferredCamera === 'function') {
      window.AndroidInterface.selectPreferredCamera();
    } else {
      alert("A seleção de câmera preferida está disponível no app Android.");
    }
  });
}

const clearCameraBtn = document.getElementById('clearCameraBtn');
if (clearCameraBtn) {
  clearCameraBtn.addEventListener('click', () => {
    localStorage.removeItem('preferred_camera_label');
    if (window.AndroidInterface && typeof window.AndroidInterface.clearPreferredCamera === 'function') {
      window.AndroidInterface.clearPreferredCamera();
    }
    updatePreferredCameraUI();
  });
}

if (systemSettingsBtn) {
  systemSettingsBtn.addEventListener('click', openSystemSettings);
}
if (openPhotoSettingsBtn) {
  openPhotoSettingsBtn.addEventListener('click', openSystemSettings);
}

if (closeSystemSettingsBtn && systemSettingsModal) {
  closeSystemSettingsBtn.addEventListener('click', () => {
    systemSettingsModal.style.display = 'none';
  });
}

if (selectStorageFolderBtn) {
  if (window.AndroidInterface && typeof window.AndroidInterface.selectStorageFolder === 'function') {
    selectStorageFolderBtn.style.display = 'block';
    selectStorageFolderBtn.addEventListener('click', () => {
      window.AndroidInterface.selectStorageFolder();
    });
  } else {
    selectStorageFolderBtn.style.display = 'none';
  }
}

window.onStorageFolderSelected = function(folderName) {
  if (selectedFolderLabel) {
    selectedFolderLabel.textContent = `Pasta selecionada: ${folderName}`;
  }
  localStorage.setItem('photo_folder_name_friendly', folderName);
};

if (closePhotoManagerButton) {
  closePhotoManagerButton.addEventListener('click', () => {
    // Close the modal without deleting stored photos from IndexedDB
    if (photoManagerModal) photoManagerModal.style.display = 'none';
    activePhotoVehicleName = '';
    activePhotoId = '';
    localStorage.removeItem('active_photo_id');
    localStorage.removeItem('active_photo_vehicle_name');
    if (photoGridContainer) photoGridContainer.innerHTML = '';
  });
}

function openInspectionFolderForId(id) {
  const item = items.find(entry => entry.id === id) || supervisoes.find(s => s.id === id);
  if (!item) {
    alert('Erro: Registro não encontrado!');
    return;
  }
  const vehicleName = item.plate || item.vehicle;
  if (!vehicleName || !vehicleName.trim()) {
    alert('Nome do veículo ou placa inválido!');
    return;
  }
  if (window.AndroidInterface && typeof window.AndroidInterface.openInspectionFolder === 'function') {
    window.AndroidInterface.openInspectionFolder(vehicleName.trim());
  } else {
    alert("Esta funcionalidade de acessar a pasta só está disponível no aplicativo Android.");
  }
}

function openPhotoManagerForId(id) {
  const item = items.find(entry => entry.id === id) || supervisoes.find(s => s.id === id);
  if (!item) {
    alert('Erro: Registro não encontrado!');
    return;
  }
  const vehicleName = item.plate || item.vehicle;
  if (!vehicleName || !vehicleName.trim()) {
    alert('Por favor, preencha o campo "Veículo (Modelo e Placa)" antes de acessar as fotos.');
    return;
  }
  openPhotoManagerForVehicle(id, vehicleName.trim());
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mimeType = 'image/jpeg') {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(cleanBase64);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: mimeType });
}

let pendingSequenceShare = null;
let isCheckingSequenceShare = false;

function showToastNotification(message, duration = 3000) {
  let toast = document.getElementById('appToastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToastNotification';
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      background: #0f172a;
      color: #ffffff;
      padding: 13px 22px;
      border-radius: 14px;
      font-size: 0.90rem;
      font-weight: 700;
      box-shadow: 0 12px 35px -5px rgba(0,0,0,0.45);
      z-index: 999999;
      opacity: 0;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      text-align: center;
      max-width: 90%;
      pointer-events: none;
      border: 1.5px solid #22c55e;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  
  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
  }, duration);
}

function showCenteredSuccessModal(message, duration = 3000, callback = null) {
  let overlay = document.getElementById('appCenteredSuccessOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'appCenteredSuccessOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999999;
      opacity: 0;
      transition: opacity 0.25s ease;
      padding: 20px;
      box-sizing: border-box;
    `;

    const card = document.createElement('div');
    card.id = 'appCenteredSuccessCard';
    card.style.cssText = `
      background: #ffffff;
      color: #0f172a;
      padding: 26px 28px;
      border-radius: 20px;
      box-shadow: 0 20px 45px -10px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      max-width: 360px;
      width: 100%;
      text-align: center;
      transform: scale(0.9);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      border: 2px solid #22c55e;
    `;

    card.innerHTML = `
      <div style="width: 58px; height: 58px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 1.9rem; font-weight: 900; box-shadow: 0 4px 14px rgba(34,197,94,0.3);">
        ✓
      </div>
      <div id="appCenteredSuccessMsg" style="font-size: 1.08rem; font-weight: 800; color: #0f172a; line-height: 1.35; margin-top: 4px;">
        ${message}
      </div>
      <div style="font-size: 0.78rem; font-weight: 700; color: #16a34a; background: #f0fdf4; padding: 4px 14px; border-radius: 999px; border: 1px solid #bbf7d0; margin-top: 2px;">
        Retornando à vistoria em instantes...
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  } else {
    const msgEl = document.getElementById('appCenteredSuccessMsg');
    if (msgEl) msgEl.textContent = message;
  }

  const card = document.getElementById('appCenteredSuccessCard');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    if (card) card.style.transform = 'scale(1)';
  });

  if (window._centeredSuccessTimeout) clearTimeout(window._centeredSuccessTimeout);
  window._centeredSuccessTimeout = setTimeout(() => {
    overlay.style.opacity = '0';
    if (card) card.style.transform = 'scale(0.9)';
    setTimeout(() => {
      overlay.style.display = 'none';
      if (typeof callback === 'function') callback();
    }, 250);
  }, duration);
}

// Verifica se existem fotos ou vídeos associados ao veículo/supervisão
async function checkHasMediaForVehicle(vehicleName, isSupervisao) {
  if (!vehicleName || !vehicleName.trim()) return false;
  const cleanName = vehicleName.trim();
  const key = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Vistorias sempre possuem fotos e devem sempre executar o fluxo completo
  if (!isSupervisao) {
    return true;
  }

  // 1. Se estiver no app Android e a função nativa existir, consulta o armazenamento do celular em tempo real
  if (window.AndroidInterface && typeof window.AndroidInterface.hasMediaForVehicle === 'function') {
    try {
      return window.AndroidInterface.hasMediaForVehicle(cleanName, true);
    } catch (e) {
      console.warn('Erro ao consultar hasMediaForVehicle no Android:', e);
    }
  }

  // 2. Consulta registro de fotos tiradas para esta supervisão
  const supItem = supervisoes.find(s => (s.vehicle && s.vehicle.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === key) || (s.plate && s.plate.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === key));
  if (supItem && supItem.hasPhotos === true) {
    return true;
  }

  if (localStorage.getItem('has_photos_' + key) === 'true' || sessionStorage.getItem('has_photos_' + key) === 'true') {
    return true;
  }

  // 3. Consulta fotos/vídeos armazenados no IndexedDB
  try {
    const stored = await getStoredPhotosForVehicle(cleanName);
    if (stored && stored.length > 0) {
      return true;
    }
  } catch (e) {
    console.warn('Erro ao consultar fotos no IndexedDB:', e);
  }

  return false;
}
window.checkHasMediaForVehicle = checkHasMediaForVehicle;

// Compartilhamento Sequencial Automático (1 clique: Texto primeiro, depois Mídias no retorno)
async function shareVistoriaWhatsAppSequence(id) {
  const item = items.find(entry => entry.id === id) || supervisoes.find(s => s.id === id);
  if (!item) {
    alert('Registro não encontrado!');
    return;
  }
  const vehicleName = (item.plate || item.vehicle || '').trim();
  if (!vehicleName) {
    alert('Nome do veículo ou placa inválido!');
    return;
  }

  const isSupervisao = !items.some(entry => entry.id === id);

  // Prepara o estado do segundo passo (fotos)
  pendingSequenceShare = {
    id: id,
    vehicleName: vehicleName,
    isSupervisao: isSupervisao,
    step: 'media',
    timestamp: Date.now()
  };
  try {
    sessionStorage.setItem('pending_sequence_share', JSON.stringify(pendingSequenceShare));
  } catch(e) {}

  showToastNotification('Passo 1/2: Enviando texto no WhatsApp. Ao voltar ao app, as fotos serão enviadas automaticamente!', 5000);

  // Passo 1: Dispara o envio do texto para o WhatsApp
  shareVistoriaWhatsApp(id, 'text');
}
window.shareVistoriaWhatsAppSequence = shareVistoriaWhatsAppSequence;

async function checkPendingSequenceShare() {
  if (isCheckingSequenceShare) return;
  let pending = pendingSequenceShare;
  if (!pending) {
    try {
      const raw = sessionStorage.getItem('pending_sequence_share');
      if (raw) pending = JSON.parse(raw);
    } catch(e) {}
  }

  if (pending && pending.step === 'media') {
    const elapsed = Date.now() - (pending.timestamp || 0);
    // Dispara somente se o envio do texto ocorreu entre 800ms e 10 minutos atrás
    if (elapsed > 800 && elapsed < 10 * 60 * 1000) {
      isCheckingSequenceShare = true;
      pendingSequenceShare = null;
      try {
        sessionStorage.removeItem('pending_sequence_share');
      } catch(e) {}

      setTimeout(() => {
        showToastNotification('Passo 2/2: Abrindo fotos no WhatsApp para o mesmo contato...', 4000);
        shareVistoriaWhatsApp(pending.id, 'media');
        setTimeout(() => {
          isCheckingSequenceShare = false;
        }, 1500);
      }, 600);
    }
  }
}

window.addEventListener('focus', checkPendingSequenceShare);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkPendingSequenceShare();
  }
});

// Compartilha fotos + relatório. Se não há fotos, compartilha só o relatório.
async function shareVistoriaWhatsApp(id, shareMode) {
  const item = items.find(entry => entry.id === id) || supervisoes.find(s => s.id === id);
  if (!item) {
    alert('Registro não encontrado!');
    return;
  }
  const vehicleName = (item.plate || item.vehicle || '').trim();
  if (!vehicleName) {
    alert("Nome do veículo ou placa inválido!");
    return;
  }

  const isInspection = items.some(entry => entry.id === id);
  let reportText = isInspection ? getSurveyText(id) : formatSingleSupervisaoText(item);
  if (!reportText || !reportText.trim()) {
    reportText = `Vistoria do veículo: ${vehicleName}`;
  }

  copyTextToClipboard(reportText);

  if (window.AndroidInterface) {
    // Sincroniza fotos apenas se não for compartilhamento exclusivo de texto
    if (shareMode !== 'text') {
      try {
        const storedPhotos = await getStoredPhotosForVehicle(vehicleName);
        if (storedPhotos && storedPhotos.length > 0) {
          for (const p of storedPhotos) {
            if (p.rawBlob) {
              const base64 = await blobToBase64(p.rawBlob);
              if (base64) {
                const rawData = base64.includes(',') ? base64.split(',')[1] : base64;
                if (typeof window.AndroidInterface.savePhotoSync === 'function') {
                  window.AndroidInterface.savePhotoSync(vehicleName, p.name, rawData);
                } else if (typeof window.AndroidInterface.savePhoto === 'function') {
                  window.AndroidInterface.savePhoto(vehicleName, p.name, rawData);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("Erro ao sincronizar fotos web para Android antes do envio WhatsApp:", e);
      }
    }

    if (shareMode === 'text') {
      if (typeof window.AndroidInterface.shareVistoriaWhatsAppText === 'function') {
        window.AndroidInterface.shareVistoriaWhatsAppText(vehicleName, reportText);
        return;
      } else if (typeof window.AndroidInterface.shareText === 'function') {
        window.AndroidInterface.shareText(`Relatório: ${vehicleName}`, reportText);
        return;
      } else {
        const encodedText = encodeURIComponent(reportText);
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
        return;
      }
    } else if (shareMode === 'media') {
      if (typeof window.AndroidInterface.shareVistoriaWhatsAppMedia === 'function') {
        window.AndroidInterface.shareVistoriaWhatsAppMedia(vehicleName, reportText);
        return;
      } else if (typeof window.AndroidInterface.shareVistoriaWhatsApp === 'function') {
        window.AndroidInterface.shareVistoriaWhatsApp(vehicleName, reportText);
        return;
      } else if (typeof window.AndroidInterface.startShareWithDate === 'function') {
        window.AndroidInterface.startShareWithDate(vehicleName, reportText, '');
        return;
      }
    }
  }

  try {
    const storedPhotos = await getStoredPhotosForVehicle(vehicleName);
    let filesToShare = [];
    if (storedPhotos && storedPhotos.length > 0) {
      for (const p of storedPhotos) {
        if (p.rawBlob) {
          let mimeType = p.rawBlob.type;
          if (!mimeType || mimeType === 'application/octet-stream') {
            const isVid = /\.(mp4|3gp|mov|mkv|webm)$/i.test(p.name);
            mimeType = isVid ? 'video/mp4' : 'image/jpeg';
          }
          filesToShare.push(new File([p.rawBlob], p.name, { type: mimeType }));
        }
      }
    }

    if (shareMode === 'media' && filesToShare.length === 0) {
      console.log('Nenhuma mídia encontrada para compartilhamento.');
      return;
    }

    if (navigator.share) {
      if (filesToShare.length > 0 && navigator.canShare && navigator.canShare({ files: filesToShare })) {
        // Envia todas as fotos em lote 100% único sem texto atrelado para evitar divisão em 3 lotes no WhatsApp
        await navigator.share({
          title: 'Vistoria: ' + vehicleName,
          files: filesToShare
        });
        return;
      } else if (shareMode !== 'media') {
        await navigator.share({
          title: 'Vistoria: ' + vehicleName,
          text: reportText
        });
        return;
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.warn('navigator.share falhou, utilizando fallback de texto/WhatsApp:', err);
  }

  if (shareMode === 'media') {
    return;
  }

  try {
    const encodedText = encodeURIComponent(reportText);
    const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(waUrl, '_blank');
  } catch (e) {
    alert('Relatório copiado para a área de transferência!');
  }
}

// Mantido para compatibilidade interna
async function sharePhotosForSurvey(id) {
  shareVistoria(id);
}

function openPhotoManagerForVehicle(id, vehicleName) {
  activePhotoId = id;
  activePhotoVehicleName = vehicleName;
  localStorage.setItem('active_photo_id', id);
  localStorage.setItem('active_photo_vehicle_name', vehicleName);

  if (vehicleName) {
    const key = vehicleName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    localStorage.setItem('has_photos_' + key, 'true');
    sessionStorage.setItem('has_photos_' + key, 'true');
    const sup = supervisoes.find(s => s.id === id || (s.vehicle && s.vehicle.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === key));
    if (sup) {
      sup.hasPhotos = true;
      saveSupervisoes();
    }
  }

  if (window.AndroidInterface && typeof window.AndroidInterface.launchCameraCapture === 'function') {
    window.AndroidInterface.launchCameraCapture(vehicleName);
  } else if (photoSystemCameraInput) {
    photoSystemCameraInput.click();
  } else {
    const titleEl = document.getElementById('photoManagerTitle');
    if (titleEl) titleEl.textContent = `Fotos - ${vehicleName}`;
    if (photoManagerModal) photoManagerModal.style.display = 'flex';
    loadPhotosForActiveVehicle();
  }
}

async function loadPhotosForActiveVehicle() {
  if (photoGridContainer) {
    photoGridContainer.innerHTML = '<div class="empty-photos">Carregando fotos...</div>';
  }
  
  const photos = await getStoredPhotosForVehicle(activePhotoVehicleName);
  renderPhotoGrid(photos);
}

function isVideoFile(filename, rawBlob) {
  if (rawBlob && rawBlob.type && rawBlob.type.startsWith('video/')) return true;
  if (filename) {
    const lower = filename.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.3gp') || lower.endsWith('.mov') || lower.endsWith('.mkv') || lower.endsWith('.webm');
  }
  return false;
}

function renderPhotoGrid(photos) {
  if (!photoGridContainer) return;
  
  if (!photos || photos.length === 0) {
    photoGridContainer.innerHTML = '<div class="empty-photos">Nenhuma foto adicionada para esta vistoria.</div>';
    return;
  }
  
  photoGridContainer.innerHTML = photos.map(photo => {
    const isVid = isVideoFile(photo.name, photo.rawBlob);
    if (isVid) {
      return `
        <div class="photo-item" style="position: relative;">
          <video src="${photo.url}" controls style="width: 100%; height: 100px; object-fit: cover; border-radius: 8px;"></video>
          <button class="delete-photo" onclick="deletePhotoEvent('${photo.name}')" type="button">×</button>
        </div>
      `;
    }
    return `
      <div class="photo-item">
        <img src="${photo.url}" alt="Vistoria" onclick="viewFullImage('${photo.url}', false)" style="cursor: pointer;" />
        <button class="delete-photo" onclick="deletePhotoEvent('${photo.name}')" type="button">×</button>
      </div>
    `;
  }).join('');
}

function viewFullImage(url, isVid) {
  const overlay = document.createElement('div');
  overlay.className = 'photo-modal-overlay';
  overlay.style.cursor = 'pointer';
  overlay.onclick = () => document.body.removeChild(overlay);
  
  if (isVid) {
    const vid = document.createElement('video');
    vid.src = url;
    vid.controls = true;
    vid.autoplay = true;
    vid.style.maxWidth = '95%';
    vid.style.maxHeight = '95%';
    vid.style.borderRadius = '16px';
    overlay.appendChild(vid);
  } else {
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '95%';
    img.style.maxHeight = '95%';
    img.style.borderRadius = '16px';
    img.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.5)';
    overlay.appendChild(img);
  }
  
  document.body.appendChild(overlay);
}

function getDb() {
  return new Promise((resolve) => {
    if (db) return resolve(db);
    const check = setInterval(() => {
      if (db) {
        clearInterval(check);
        resolve(db);
      }
    }, 50);
  });
}

async function getStoredPhotosForVehicle(vehicleName) {
  const localDb = await getDb();
  return new Promise((resolve) => {
    const tx = localDb.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
    const index = store.openCursor();
    const results = [];
    index.onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        const val = cursor.value;
        if (val.visitId === vehicleName) {
          const url = URL.createObjectURL(val.blob);
          results.push({ name: val.name, url: url, rawBlob: val.blob });
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    index.onerror = function() {
      resolve([]);
    };
  });
}

async function savePhotoToDb(vehicleName, name, blob) {
  const localDb = await getDb();
  return new Promise((resolve) => {
    const tx = localDb.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    const id = `${vehicleName}_${name}`;
    store.put({ id: id, visitId: vehicleName, name: name, blob: blob });
    tx.oncomplete = () => resolve();
  });
}

async function removePhotoFromDb(vehicleName, name) {
  const localDb = await getDb();
  return new Promise((resolve) => {
    const tx = localDb.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    const id = `${vehicleName}_${name}`;
    store.delete(id);
    tx.oncomplete = () => resolve();
  });
}

if (capturePhotoButton) {
  capturePhotoButton.addEventListener('click', () => {
    if (window.AndroidInterface && typeof window.AndroidInterface.launchCameraCapture === 'function') {
      window.AndroidInterface.launchCameraCapture(activePhotoVehicleName);
    } else if (photoSystemCameraInput) {
      photoSystemCameraInput.click();
    }
  });
}

window.onPhotoCapturedFromAndroid = async function(vehicleName, filename, base64Data) {
  try {
    if (vehicleName) {
      activePhotoVehicleName = vehicleName;
      localStorage.setItem('active_photo_vehicle_name', vehicleName);
      const key = vehicleName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      localStorage.setItem('has_photos_' + key, 'true');
      sessionStorage.setItem('has_photos_' + key, 'true');
      const sup = supervisoes.find(s => (s.vehicle && s.vehicle.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === key));
      if (sup) {
        sup.hasPhotos = true;
        saveSupervisoes();
      }
    }
    
    if (filename && vehicleName) {
      const isVid = /\.(mp4|3gp|mov|mkv|webm)$/i.test(filename);
      if (base64Data) {
        try {
          const blob = base64ToBlob(base64Data, isVid ? 'video/mp4' : 'image/jpeg');
          await savePhotoToDb(vehicleName, filename, blob);
        } catch (err) {
          console.warn("Erro ao registrar mídia capturada no IndexedDB:", err);
        }
      }
    }

    if (typeof loadPhotosForActiveVehicle === 'function') {
      loadPhotosForActiveVehicle();
    }

    if (localStorage.getItem('waiting_camera_return') === 'true') {
      localStorage.removeItem('waiting_camera_return');
    }
  } catch (e) {
    console.error("Erro ao processar mídia capturada do Android:", e);
  }
};

window.onPhotoSaveFailed = function(errorMsg) {
  alert("Erro ao salvar foto no celular: " + errorMsg);
};

if (photoSystemFileInput) {
  photoSystemFileInput.addEventListener('change', (e) => handlePhotoFilesSelected(e.target.files));
}
if (photoSystemCameraInput) {
  photoSystemCameraInput.addEventListener('change', (e) => handlePhotoFilesSelected(e.target.files));
}

async function handlePhotoFilesSelected(files) {
  if (!files || files.length === 0) return;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const timestamp = Date.now();
    const isVid = file.type.startsWith('video/') || /\.(mp4|3gp|mov|mkv|webm)$/i.test(file.name);
    let ext = 'jpg';
    if (isVid) {
      const parts = file.name.split('.');
      ext = parts.length > 1 ? parts.pop().toLowerCase() : 'mp4';
    }
    const prefix = isVid ? 'video' : 'foto';
    const filename = `${prefix}_${timestamp}_${i}.${ext}`;
    
    await savePhotoToDb(activePhotoVehicleName, filename, file);
    
    // Salvar no Android se disponível na WebView (evitando crash OOM em vídeos grandes)
    if (window.AndroidInterface && typeof window.AndroidInterface.savePhoto === 'function') {
      try {
        if (!isVid || file.size < 5 * 1024 * 1024) {
          const base64Data = await readBlobAsBase64(file);
          window.AndroidInterface.savePhoto(activePhotoVehicleName, filename, base64Data, "Vistorias");
        }
      } catch (err) {
        console.error('Error saving file to Android via interface:', err);
      }
    }
    
    if (directoryHandle) {
      try {
        const config = getPhotoConfig();
        const baseFolder = await directoryHandle.getDirectoryHandle(config.folderName || 'Vistorias', { create: true });
        const vehicleFolder = await baseFolder.getDirectoryHandle(activePhotoVehicleName, { create: true });
        const fileHandle = await vehicleFolder.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        console.log(`Saved ${filename} to local filesystem.`);
      } catch (err) {
        console.error('Failed to write to local directory handle:', err);
      }
    }
  }
  
  loadPhotosForActiveVehicle();
}

window.deletePhotoEvent = async function(name) {
  if (confirm('Deseja realmente excluir esta foto?')) {
    await removePhotoFromDb(activePhotoVehicleName, name);
    loadPhotosForActiveVehicle();
  }
};

function readBlobAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}

const savePhotosToFolderBtn = document.getElementById('savePhotosToFolderBtn');
if (savePhotosToFolderBtn) {
  savePhotosToFolderBtn.addEventListener('click', async () => {
    const photos = await getStoredPhotosForVehicle(activePhotoVehicleName);
    if (!photos || photos.length === 0) {
      alert('Nenhuma foto para salvar nesta vistoria.');
      return;
    }
    
    if (window.AndroidInterface && typeof window.AndroidInterface.savePhoto === 'function') {
      let savedCount = 0;
      for (const photo of photos) {
        try {
          const base64Data = await readBlobAsBase64(photo.rawBlob);
          window.AndroidInterface.savePhoto(activePhotoVehicleName, photo.name, base64Data, "Vistorias");
          savedCount++;
        } catch (e) {
          console.error("Erro ao ler foto para base64:", e);
        }
      }
    } else {
      alert('Dispositivo Android não detectado ou recurso indisponível.');
    }
  });
}

// Attach listener to Inclusion Form photos button
const formPhotosBtn = document.getElementById('formPhotosButton');
if (formPhotosBtn) {
  formPhotosBtn.addEventListener('click', () => {
    const plateValue = plateInput.value.trim();
    if (!plateValue) {
      alert('Por favor, preencha o campo "Veículo (Modelo e Placa)" antes de tirar fotos.');
      return;
    }
    openPhotoManagerForVehicle(editingId || 'new_form_item', plateValue);
  });
}

// Attach listener to Supervision Form photos button
const supervisaoFormPhotosBtn = document.getElementById('supervisaoFormPhotosButton');
if (supervisaoFormPhotosBtn) {
  supervisaoFormPhotosBtn.addEventListener('click', () => {
    const vehicleValue = supervisaoVehicleInput.value.trim();
    if (!vehicleValue) {
      alert('Por favor, preencha o campo "Veículo (Modelo e Placa)" antes de tirar fotos.');
      return;
    }
    openPhotoManagerForVehicle(editingSupervisaoId || 'new_supervisao_item', vehicleValue);
  });
}

// ==========================================
// SYSTEM BACKUP & RESTORE IMPLEMENTATION
// ==========================================

function downloadJsonFile(filename, jsonString) {
  if (window.AndroidInterface && typeof window.AndroidInterface.exportBackup === 'function') {
    window.AndroidInterface.exportBackup(filename, jsonString);
    return;
  }

  if ('showSaveFilePicker' in window) {
    window.showSaveFilePicker({
      suggestedName: filename,
      types: [{
        description: 'Arquivo JSON de Backup',
        accept: { 'application/json': ['.json'] }
      }]
    }).then(async (handle) => {
      const writable = await handle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      alert('Backup salvo com sucesso no local escolhido!');
    }).catch((err) => {
      if (err.name === 'AbortError') return; // usuário cancelou
      console.warn('showSaveFilePicker falhou, utilizando fallback:', err);
      fallbackDownloadJson(filename, jsonString);
    });
    return;
  }

  fallbackDownloadJson(filename, jsonString);
}

function fallbackDownloadJson(filename, jsonString) {
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

let currentBackupJsonString = '';
let currentBackupFilename = '';

async function triggerExportBackup() {
  try {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      backup[key] = localStorage.getItem(key);
    }
    
    currentBackupJsonString = JSON.stringify(backup, null, 2);
    currentBackupFilename = `backup_sistema_vistoria_${new Date().toISOString().slice(0, 10)}.json`;

    const backupExportModal = document.getElementById('backupExportModal');
    const backupTextarea = document.getElementById('backupTextarea');
    if (backupExportModal && backupTextarea) {
      backupTextarea.value = currentBackupJsonString;
      backupExportModal.style.display = 'flex';
    } else {
      downloadJsonFile(currentBackupFilename, currentBackupJsonString);
    }
  } catch (err) {
    alert('Erro ao exportar backup: ' + err.message);
  }
}

function closeBackupExportModal() {
  const backupExportModal = document.getElementById('backupExportModal');
  if (backupExportModal) backupExportModal.style.display = 'none';
}

function openPasteImportModal() {
  const backupPasteImportModal = document.getElementById('backupPasteImportModal');
  const pasteBackupTextarea = document.getElementById('pasteBackupTextarea');
  if (pasteBackupTextarea) pasteBackupTextarea.value = '';
  if (backupPasteImportModal) backupPasteImportModal.style.display = 'flex';
}

function closePasteImportModal() {
  const backupPasteImportModal = document.getElementById('backupPasteImportModal');
  if (backupPasteImportModal) backupPasteImportModal.style.display = 'none';
}

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

function restoreBackupFromJsonString(jsonString) {
  if (!jsonString || !jsonString.trim()) {
    alert('Por favor, cole o código do backup no campo de texto.');
    return;
  }
  try {
    const data = repairTruncatedJson(jsonString);
    if (confirm('Deseja realmente restaurar este backup? Isso substituirá os dados atuais do sistema.')) {
      let restoredKeys = 0;
      localStorage.clear();
      Object.keys(data).forEach(key => {
        localStorage.setItem(key, data[key]);
        restoredKeys++;
      });
      alert(`✅ Backup importado com sucesso! (${restoredKeys} chaves restauradas). O sistema será recarregado.`);
      window.location.reload();
    }
  } catch (err) {
    alert('Erro ao restaurar backup: ' + err.message);
  }
}

function triggerImportBackup() {
  const dashboardBackupFileInput = document.getElementById('dashboardBackupFileInput');
  if (dashboardBackupFileInput) {
    dashboardBackupFileInput.click();
  }
}

window.triggerExportBackup = triggerExportBackup;
window.triggerImportBackup = triggerImportBackup;
window.exportBackup = triggerExportBackup;
window.importBackup = triggerImportBackup;
window.closeBackupExportModal = closeBackupExportModal;
window.openPasteImportModal = openPasteImportModal;
window.closePasteImportModal = closePasteImportModal;

const exportBackupBtn = document.getElementById('exportBackupBtn');
const importBackupBtn = document.getElementById('importBackupBtn');
const dashboardBackupFileInput = document.getElementById('dashboardBackupFileInput');
const copyBackupTextBtn = document.getElementById('copyBackupTextBtn');
const downloadBackupFileBtn = document.getElementById('downloadBackupFileBtn');
const shareBackupTextBtn = document.getElementById('shareBackupTextBtn');
const submitPasteBackupBtn = document.getElementById('submitPasteBackupBtn');

if (exportBackupBtn) {
  exportBackupBtn.addEventListener('click', triggerExportBackup);
}

if (copyBackupTextBtn) {
  copyBackupTextBtn.addEventListener('click', () => {
    if (!currentBackupJsonString) return;
    copyTextToClipboard(currentBackupJsonString);
    alert('✅ Código do backup copiado com sucesso! Você pode colar no WhatsApp, bloco de notas ou e-mail.');
  });
}

if (downloadBackupFileBtn) {
  downloadBackupFileBtn.addEventListener('click', () => {
    if (!currentBackupJsonString || !currentBackupFilename) return;
    downloadJsonFile(currentBackupFilename, currentBackupJsonString);
  });
}

if (shareBackupTextBtn) {
  shareBackupTextBtn.addEventListener('click', async () => {
    if (!currentBackupJsonString) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Backup do Sistema de Vistoria',
          text: currentBackupJsonString
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    copyTextToClipboard(currentBackupJsonString);
    try {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(currentBackupJsonString)}`;
      window.open(waUrl, '_blank');
    } catch (e) {
      alert('Código do backup copiado para a área de transferência!');
    }
  });
}

if (submitPasteBackupBtn) {
  submitPasteBackupBtn.addEventListener('click', () => {
    const pasteBackupTextarea = document.getElementById('pasteBackupTextarea');
    if (pasteBackupTextarea) {
      restoreBackupFromJsonString(pasteBackupTextarea.value);
    }
  });
}

if (importBackupBtn && dashboardBackupFileInput) {
  importBackupBtn.addEventListener('click', triggerImportBackup);

  dashboardBackupFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (confirm('Deseja realmente importar o backup? Isso substituirá todas as informações atuais do sistema.')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        restoreBackupFromJsonString(e.target.result);
      };
      reader.readAsText(file);
    }
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (window.AndroidInterface && typeof window.AndroidInterface.onPageLoaded === 'function') {
      window.AndroidInterface.onPageLoaded();
    }
    // Não limpa active_photo_vehicle_name para não perder contexto
    // caso o usuário feche a câmera sem tirar foto.
  }
});

window.onAndroidBackButtonPressed = function() {
  const systemSettingsModal = document.getElementById('systemSettingsModal');
  if (systemSettingsModal && systemSettingsModal.style.display === 'flex') {
    systemSettingsModal.style.display = 'none';
    return true;
  }
  
  const photoManagerModal = document.getElementById('photoManagerModal');
  if (photoManagerModal && photoManagerModal.style.display === 'flex') {
    const closePhotoManagerButton = document.getElementById('closePhotoManagerButton');
    if (closePhotoManagerButton) closePhotoManagerButton.click();
    return true;
  }

  const appContent = document.getElementById('appContent');
  const backToMenuButton = document.getElementById('backToMenuButton');
  if (appContent && appContent.style.display !== 'none' && backToMenuButton) {
    backToMenuButton.click();
    return true;
  }

  return false;
};


window.gerarPastaNova = function() {
  const plateInput = document.getElementById('plateInput');
  const vehicleName = plateInput ? plateInput.value : '';
  if (!vehicleName || !vehicleName.trim()) {
    alert('Por favor, preencha o Modelo e Placa do veículo primeiro.');
    return;
  }
  if (window.AndroidInterface && typeof window.AndroidInterface.createInspectionFolder === 'function') {
    window.AndroidInterface.createInspectionFolder(vehicleName.trim());
  } else {
    alert('Esta funcionalidade de gerar a pasta só está disponível no aplicativo Android.');
  }
};

window.gerarPastaNovaSupervisao = function() {
  const input = document.getElementById('supervisaoVehicleInput');
  const vehicleName = input ? input.value : '';
  if (!vehicleName || !vehicleName.trim()) {
    alert('Por favor, preencha o Modelo e Placa do veículo primeiro.');
    return;
  }
  if (window.AndroidInterface && typeof window.AndroidInterface.createInspectionFolder === 'function') {
    window.AndroidInterface.createInspectionFolder(vehicleName.trim());
  } else {
    alert('Esta funcionalidade de gerar a pasta só está disponível no aplicativo Android.');
  }
};

/* ==========================================================================
   INTEGRAÇÃO MÓDULO DE PARTES DE VEÍCULOS (ZONAS & ORÇAMENTAÇÃO)
   ========================================================================== */

const VP_BASE_ZONES_CAR = [
  {
    id: 'dianteira',
    name: 'Diant.',
    icon: '🚗',
    parts: [
      'Capô do motor',
      'Para-choque Diant.',
      'Grade Diant.',
      'Alma do para-choque Diant.',
      'Farol Diant. LD',
      'Farol Diant. LE',
      'Farol de milha LD',
      'Farol de milha LE',
      'Para-lama Diant. LD',
      'Para-lama Diant. LE',
      'Painel frontal / mini-frente',
      'Radiador de água',
      'Condensador do ar-condicionado',
      'Eletroventilador / ventoinha',
      'Guia do para-choque Diant. LD',
      'Guia do para-choque Diant. LE',
      'Emblema frontal da montadora'
    ]
  },
  {
    id: 'traseira',
    name: 'Tras.',
    icon: '🚘',
    parts: [
      'Tampa do porta-malas / Tras.',
      'Para-choque Tras.',
      'Alma do para-choque Tras.',
      'Lanterna Tras. LD',
      'Lanterna Tras. LE',
      'Lanterna tampa Tras. LD',
      'Lanterna tampa Tras. LE',
      'Painel Tras.',
      'Assoalho do porta-malas',
      'Guia do para-choque Tras. LD',
      'Guia do para-choque Tras. LE',
      'Refletor Tras. LD',
      'Refletor Tras. LE',
      'Emblema Tras. da montadora'
    ]
  },
  {
    id: 'lateral_dir',
    name: 'Lateral LD',
    icon: '➡️',
    parts: [
      'Porta Diant. LD',
      'Porta Tras. LD',
      'Retrovisor LD completo',
      'Capa do retrovisor LD',
      'Espelho do retrovisor LD',
      'Caixa de ar / soleira LD',
      'Coluna A Diant. LD',
      'Coluna B central LD',
      'Coluna C Tras. LD',
      'Lateral Tras. LD (painel)',
      'Friso da porta Diant. LD',
      'Friso da porta Tras. LD',
      'Maçaneta Diant. LD',
      'Maçaneta Tras. LD'
    ]
  },
  {
    id: 'lateral_esq',
    name: 'Lateral LE',
    icon: '⬅️',
    parts: [
      'Porta Diant. LE (motorista)',
      'Porta Tras. LE',
      'Retrovisor LE completo',
      'Capa do retrovisor LE',
      'Espelho do retrovisor LE',
      'Caixa de ar / soleira LE',
      'Coluna A Diant. LE',
      'Coluna B central LE',
      'Coluna C Tras. LE',
      'Lateral Tras. LE (painel)',
      'Friso da porta Diant. LE',
      'Friso da porta Tras. LE',
      'Maçaneta Diant. LE',
      'Maçaneta Tras. LE'
    ]
  },
  {
    id: 'estrutura_teto',
    name: 'Teto & Estrutura',
    icon: '🛡️',
    parts: [
      'Painel do teto',
      'Travessa superior do teto',
      'Longarina Diant. LD',
      'Longarina Diant. LE',
      'Ponta de longarina Diant. LD',
      'Ponta de longarina Diant. LE',
      'Longarina Tras. LD',
      'Longarina Tras. LE',
      'Caixa de roda Diant. LD',
      'Caixa de roda Diant. LE',
      'Caixa de roda Tras. LD',
      'Caixa de roda Tras. LE',
      'Painel corta-fogo'
    ]
  },
  {
    id: 'mecanica_susp',
    name: 'Mecânica & Suspensão',
    icon: '⚙️',
    parts: [
      'Amortecedor Diant. LD',
      'Amortecedor Diant. LE',
      'Amortecedor Tras. LD',
      'Amortecedor Tras. LE',
      'Bandeja de suspensão Diant. LD',
      'Bandeja de suspensão Diant. LE',
      'Quadro / agregado da suspensão',
      'Eixo Tras. completo',
      'Caixa de direção hidráulica/elétrica',
      'Manga de eixo Diant. LD',
      'Manga de eixo Diant. LE',
      'Semi-eixo Diant. LD',
      'Semi-eixo Diant. LE',
      'Cárter de óleo do motor',
      'Roda Diant. LD',
      'Roda Diant. LE',
      'Roda Tras. LD',
      'Roda Tras. LE',
      'Pneu Diant. LD',
      'Pneu Diant. LE',
      'Pneu Tras. LD',
      'Pneu Tras. LE'
    ]
  },
  {
    id: 'vidros_interior',
    name: 'Vidros & Interior',
    icon: '🪟',
    parts: [
      'Vidro para-brisa Diant.',
      'Vidro Tras. / vigia',
      'Vidro porta Diant. LD',
      'Vidro porta Diant. LE',
      'Vidro porta Tras. LD',
      'Vidro porta Tras. LE',
      'Bolsa do Airbag motorista (volante)',
      'Bolsa do Airbag passageiro (painel)',
      'Cinto de segurança Diant. LD',
      'Cinto de segurança Diant. LE',
      'Painel de instrumentos / tabelier',
      'Forro de porta Diant. LD',
      'Forro de porta Diant. LE'
    ]
  }
];

const VP_BASE_ZONES_MOTO = [
  {
    id: 'dianteira_moto',
    name: 'Diant. & Guidão',
    icon: '🏍️',
    parts: [
      'Farol Diant.',
      'Carenagem do farol / bolha',
      'Guidão',
      'Manete de freio LD',
      'Manete de embreagem LE',
      'Retrovisor LD',
      'Retrovisor LE',
      'Painel de instrumentos digital/analógico',
      'Para-lama Diant.',
      'Garfo Diant. / bengala LD',
      'Garfo Diant. / bengala LE',
      'Mesa superior e inferior da direção',
      'Pisca Diant. LD',
      'Pisca Diant. LE'
    ]
  },
  {
    id: 'chassi_tanque',
    name: 'Tanque & Chassi',
    icon: '⛽',
    parts: [
      'Tanque de combustível',
      'Tampa do tanque',
      'Carenagem lateral LD do tanque',
      'Carenagem lateral LE do tanque',
      'Carenagem lateral / tampa lateral LD',
      'Carenagem lateral / tampa lateral LE',
      'Banco / assento',
      'Chassi / quadro principal',
      'Protetor de carenagem / motor',
      'Cavalete lateral / descanso',
      'Cavalete central'
    ]
  },
  {
    id: 'traseira_moto',
    name: 'Tras. & Escapamento',
    icon: '🛵',
    parts: [
      'Rabeta Tras. LD',
      'Rabeta Tras. LE',
      'Rabeta Tras. Central',
      'Lanterna Tras.',
      'Suporte de placa / para-lama Tras.',
      'Pisca Tras. LD',
      'Pisca Tras. LE',
      'Escapamento / ponteira',
      'Protetor do escapamento',
      'Protetor do bico do escapamento',
      'Balança Tras.',
      'Amortecedor Tras. LD',
      'Amortecedor Tras. LE',
      'Amortecedor central (Monoshock)',
      'Alça Tras. do garupa LD',
      'Alça Tras. do garupa LE'
    ]
  },
  {
    id: 'mecanica_moto',
    name: 'Motor & Rodas',
    icon: '⚙️',
    parts: [
      'Tampa do motor lateral LD (embreagem)',
      'Tampa do motor lateral LE (estator)',
      'Pedal de câmbio / marcha',
      'Pedal de freio Tras.',
      'Pedaleira Diant. LD',
      'Pedaleira Diant. LE',
      'Pedaleira Tras. LD (garupa)',
      'Pedaleira Tras. LE (garupa)',
      'Roda Diant.',
      'Roda Tras.',
      'Disco de freio Diant.',
      'Disco/Tambor de freio Tras.',
      'Pinça de freio Diant.',
      'Pinça de freio Tras.',
      'Pneu Diant.',
      'Pneu Tras.',
      'Corrente / relação de transmissão',
      'Guia / capa de corrente'
    ]
  }
];

const VP_BASE_ZONES_PICAPE = [
  {
    id: 'dianteira',
    name: 'Diant.',
    icon: '🚗',
    parts: [
      'Capô do motor',
      'Para-choque Diant.',
      'Grade Diant.',
      'Alma do para-choque Diant.',
      'Farol Diant. LD',
      'Farol Diant. LE',
      'Farol de milha LD',
      'Farol de milha LE',
      'Para-lama Diant. LD',
      'Para-lama Diant. LE',
      'Painel frontal / mini-frente',
      'Radiador de água',
      'Condensador do ar-condicionado',
      'Eletroventilador / ventoinha',
      'Guia do para-choque Diant. LD',
      'Guia do para-choque Diant. LE',
      'Emblema frontal da montadora'
    ]
  },
  {
    id: 'traseira_cacamba',
    name: 'Tras. & Caçamba',
    icon: '🛻',
    parts: [
      'Tampa da caçamba Tras.',
      'Maçaneta da tampa Tras.',
      'Para-choque Tras.',
      'Alma do para-choque Tras.',
      'Lanterna Tras. LD',
      'Lanterna Tras. LE',
      'Protetor de caçamba plástico',
      'Santo Antônio (barra de caçamba)',
      'Capota marítima / rígida',
      'Painel Tras. da cabine',
      'Assoalho da caçamba',
      'Emblema Tras. da montadora',
      'Estribo Tras. de acesso'
    ]
  },
  {
    id: 'lateral_dir',
    name: 'Lateral LD',
    icon: '➡️',
    parts: [
      'Porta Diant. LD',
      'Porta Tras. LD',
      'Retrovisor LD completo',
      'Capa do retrovisor LD',
      'Espelho do retrovisor LD',
      'Estribo lateral LD',
      'Caixa de ar / soleira LD',
      'Coluna A Diant. LD',
      'Coluna B central LD',
      'Coluna C Tras. LD',
      'Lateral externa da caçamba LD',
      'Moldura / alargador de para-lama LD',
      'Friso da porta Diant. LD',
      'Maçaneta Diant. LD',
      'Maçaneta Tras. LD'
    ]
  },
  {
    id: 'lateral_esq',
    name: 'Lateral LE',
    icon: '⬅️',
    parts: [
      'Porta Diant. LE (motorista)',
      'Porta Tras. LE',
      'Retrovisor LE completo',
      'Capa do retrovisor LE',
      'Espelho do retrovisor LE',
      'Estribo lateral LE',
      'Caixa de ar / soleira LE',
      'Coluna A Diant. LE',
      'Coluna B central LE',
      'Coluna C Tras. LE',
      'Lateral externa da caçamba LE',
      'Moldura / alargador de para-lama LE',
      'Friso da porta Diant. LE',
      'Maçaneta Diant. LE',
      'Maçaneta Tras. LE'
    ]
  },
  {
    id: 'estrutura_cabine',
    name: 'Teto & Estrutura',
    icon: '🛡️',
    parts: [
      'Painel do teto da cabine',
      'Rack de teto / longarina LD',
      'Rack de teto / longarina LE',
      'Longarina Diant. do chassi LD',
      'Longarina Diant. do chassi LE',
      'Longarina Tras. do chassi LD',
      'Longarina Tras. do chassi LE',
      'Caixa de roda Diant. LD',
      'Caixa de roda Diant. LE',
      'Caixa de roda Tras. LD',
      'Caixa de roda Tras. LE',
      'Protetor de cárter / peito de aço',
      'Engate de reboque Tras.'
    ]
  },
  {
    id: 'mecanica_susp',
    name: 'Mecânica & Suspensão',
    icon: '⚙️',
    parts: [
      'Amortecedor Diant. LD',
      'Amortecedor Diant. LE',
      'Amortecedor Tras. LD',
      'Amortecedor Tras. LE',
      'Feixe de molas Tras. LD',
      'Feixe de molas Tras. LE',
      'Bandeja superior Diant. LD',
      'Bandeja superior Diant. LE',
      'Bandeja inferior Diant. LD',
      'Bandeja inferior Diant. LE',
      'Diferencial Tras. / cardan',
      'Caixa de direção hidráulica/elétrica',
      'Manga de eixo Diant. LD',
      'Manga de eixo Diant. LE',
      'Roda Diant. LD',
      'Roda Diant. LE',
      'Roda Tras. LD',
      'Roda Tras. LE',
      'Pneu Diant. LD',
      'Pneu Diant. LE',
      'Pneu Tras. LD',
      'Pneu Tras. LE',
      'Pneu de estepe'
    ]
  },
  {
    id: 'vidros_interior',
    name: 'Vidros & Interior',
    icon: '🪟',
    parts: [
      'Vidro para-brisa Diant.',
      'Vidro Tras. da cabine / vigia',
      'Vidro porta Diant. LD',
      'Vidro porta Diant. LE',
      'Vidro porta Tras. LD',
      'Vidro porta Tras. LE',
      'Bolsa do Airbag motorista (volante)',
      'Bolsa do Airbag passageiro (painel)',
      'Painel de instrumentos / tabelier'
    ]
  }
];

const VP_BASE_ZONES_CAMINHAO = [
  {
    id: 'cabine_dianteira',
    name: 'Cabine & Diant.',
    icon: '🚛',
    parts: [
      'Capô frontal / tampa basculante',
      'Grade frontal superior',
      'Grade frontal inferior',
      'Para-choque Diant. central',
      'Ponteira do para-choque Diant. LD',
      'Ponteira do para-choque Diant. LE',
      'Alma / travessa do para-choque',
      'Farol Diant. principal LD',
      'Farol Diant. principal LE',
      'Farol de milha / auxiliar LD',
      'Farol de milha / auxiliar LE',
      'Lanterna de seta Diant. LD',
      'Lanterna de seta Diant. LE',
      'Para-brisa Diant.',
      'Quebra-sol externo (tapa-sol teto)',
      'Lanterna três marias / luz de teto',
      'Defletor de ar do teto (aerofólio)',
      'Defletor de ar lateral da cabine LD',
      'Defletor de ar lateral da cabine LE',
      'Emblema frontal da montadora'
    ]
  },
  {
    id: 'portas_cabine',
    name: 'Portas & Cabine',
    icon: '🚪',
    parts: [
      'Porta LD da cabine',
      'Porta LE da cabine (motorista)',
      'Retrovisor principal LD',
      'Retrovisor principal LE',
      'Retrovisor auxiliar / de rampa LD',
      'Retrovisor frontal / de aproximação',
      'Braço do retrovisor LD',
      'Braço do retrovisor LE',
      'Degraus / estribo de acesso LD',
      'Degraus / estribo de acesso LE',
      'Para-lama Diant. da cabine LD',
      'Para-lama Diant. da cabine LE',
      'Extensão do para-lama LD',
      'Extensão do para-lama LE',
      'Vidro da porta LD',
      'Vidro da porta LE',
      'Maçaneta da porta LD',
      'Maçaneta da porta LE',
      'Spoiler / saia lateral inferior LD',
      'Spoiler / saia lateral inferior LE',
      'Painel Tras. da cabine / leito'
    ]
  },
  {
    id: 'chassi_tanques',
    name: 'Chassi & Tanques',
    icon: '🛡️',
    parts: [
      'Longarina do chassi LD',
      'Longarina do chassi LE',
      'Travessa do chassi',
      'Tanque de combustível principal',
      'Tanque de combustível suplementar',
      'Tanque de Arla 32',
      'Cinta / suporte do tanque de combustível',
      'Protetor lateral ciclista LD',
      'Protetor lateral ciclista LE',
      'Caixa de bateria com tampa',
      'Suporte do pneu de estepe',
      'Pneu de estepe',
      'Caixa de ferramentas / mantimentos'
    ]
  },
  {
    id: 'mecanica_susp_caminhao',
    name: 'Mecânica & Suspensão',
    icon: '⚙️',
    parts: [
      'Feixe de molas Diant. LD',
      'Feixe de molas Diant. LE',
      'Feixe de molas Tras. LD',
      'Feixe de molas Tras. LE',
      'Bolsa de ar da suspensão',
      'Amortecedor Diant. LD',
      'Amortecedor Diant. LE',
      'Amortecedor Tras. LD',
      'Amortecedor Tras. LE',
      'Barra estabilizadora Diant.',
      'Barra estabilizadora Tras.',
      'Eixo Diant. direcional',
      'Eixo de tração (diferencial)',
      'Terceiro eixo / Truck',
      'Caixa de direção hidráulica',
      'Radiador de água',
      'Radiador Intercooler',
      'Cárter de óleo do motor'
    ]
  },
  {
    id: 'traseira_implemento',
    name: 'Tras. & Implemento',
    icon: '📦',
    parts: [
      'Para-choque Tras. homologado',
      'Faixas refletivas de segurança',
      'Lanterna Tras. LD completa',
      'Lanterna Tras. LE completa',
      'Suporte da placa Tras. com luz',
      'Para-barro de borracha Tras. LD',
      'Para-barro de borracha Tras. LE',
      'Para-lama Tras. envolvente LD',
      'Para-lama Tras. envolvente LE',
      'Mesa da quinta roda',
      'Quinta roda / engate cavalo mecânico',
      'Assoalho da caçamba / baú / carroceria',
      'Tampa Tras. da caçamba / carroceria',
      'Portas Tras. do baú',
      'Lateral do baú / furgão LD',
      'Lateral do baú / furgão LE'
    ]
  },
  {
    id: 'rodas_pneus_caminhao',
    name: 'Rodas & Pneus',
    icon: '🛞',
    parts: [
      'Roda Diant. LD',
      'Roda Diant. LE',
      'Roda tração externa LD',
      'Roda tração interna LD',
      'Roda tração externa LE',
      'Roda tração interna LE',
      'Roda truck externa LD',
      'Roda truck interna LD',
      'Roda truck externa LE',
      'Roda truck interna LE',
      'Pneu Diant. LD',
      'Pneu Diant. LE',
      'Pneu tração externo LD',
      'Pneu tração interno LD',
      'Pneu tração externo LE',
      'Pneu tração interno LE',
      'Pneu truck externo LD',
      'Pneu truck interno LD',
      'Pneu truck externo LE',
      'Pneu truck interno LE'
    ]
  }
];

let vpActiveZones = VP_BASE_ZONES_CAR;
let vpActiveZoneId = 'dianteira';
let vpDetectedVehicleType = 'carro';
let vpCurrentVehicleModelName = '';
let vpViewAllZonesMode = false;

const VP_CLOUD_ENDPOINTS = [
  '/api/catalog',
  'https://gestao-vistoria-inicial.vercel.app/api/catalog'
];
let vpSelectedPartsMap = new Map(); // key = displayName -> { name, rawName, zoneId, zoneName, action: 'troca'|'reparo', obs: '' }
let vpCustomPartsList = [];
let vpCustomPartRenamesMap = {};
let vpPartZoneOverridesMap = {}; // key = rawName/effectiveName -> zoneId
let vpDeletedPartsList = [];
let vpUsageStats = {}; // key: partName.toLowerCase() -> count
let vpIsSyncingCloud = false;

function vpUpdateCloudIndicator(status, text) {
  const iconEl = document.getElementById('vpCloudSyncIcon');
  const textEl = document.getElementById('vpCloudSyncText');
  const btnEl = document.getElementById('vpCloudSyncBtn');
  if (!iconEl && !textEl && !btnEl) return;

  if (status === 'syncing') {
    if (iconEl) iconEl.textContent = '🔄';
    if (textEl) textEl.textContent = text || 'Sincronizando...';
    if (btnEl) {
      btnEl.style.background = '#eff6ff';
      btnEl.style.borderColor = '#bfdbfe';
      btnEl.style.color = '#2563eb';
    }
  } else if (status === 'synced') {
    if (iconEl) iconEl.textContent = '☁️';
    if (textEl) textEl.textContent = text || 'Nuvem';
    if (btnEl) {
      btnEl.style.background = '#f0fdf4';
      btnEl.style.borderColor = '#bbf7d0';
      btnEl.style.color = '#16a34a';
    }
  } else {
    // Modo offline / standby
    if (iconEl) iconEl.textContent = '☁️';
    if (textEl) textEl.textContent = text || 'Nuvem';
    if (btnEl) {
      btnEl.style.background = '#f8fafc';
      btnEl.style.borderColor = '#cbd5e1';
      btnEl.style.color = '#64748b';
    }
  }
}

function vpLoadState() {
  try {
    const savedCustom = localStorage.getItem('mobile_parts_custom');
    if (savedCustom) vpCustomPartsList = JSON.parse(savedCustom);
    const savedRenames = localStorage.getItem('mobile_parts_renames');
    if (savedRenames) vpCustomPartRenamesMap = JSON.parse(savedRenames);
    const savedZoneOverrides = localStorage.getItem('mobile_parts_zone_overrides');
    if (savedZoneOverrides) vpPartZoneOverridesMap = JSON.parse(savedZoneOverrides);
    const savedDeleted = localStorage.getItem('mobile_parts_deleted');
    if (savedDeleted) vpDeletedPartsList = JSON.parse(savedDeleted);
    const savedStats = localStorage.getItem('mobile_parts_usage_stats');
    if (savedStats) vpUsageStats = JSON.parse(savedStats);
  } catch(e) {}
}

function vpSaveState(syncToCloud = false) {
  try {
    localStorage.setItem('mobile_parts_custom', JSON.stringify(vpCustomPartsList));
    localStorage.setItem('mobile_parts_renames', JSON.stringify(vpCustomPartRenamesMap));
    localStorage.setItem('mobile_parts_zone_overrides', JSON.stringify(vpPartZoneOverridesMap));
    localStorage.setItem('mobile_parts_deleted', JSON.stringify(vpDeletedPartsList));
    localStorage.setItem('mobile_parts_usage_stats', JSON.stringify(vpUsageStats));
  } catch(e) {}

  if (syncToCloud) {
    vpPushCatalogToCloud();
  }
}

function vpGetPartEffectiveZoneId(rawName, defaultZoneId) {
  if (rawName && vpPartZoneOverridesMap[rawName]) return vpPartZoneOverridesMap[rawName];
  const effective = vpGetEffectivePartName(rawName);
  if (effective && vpPartZoneOverridesMap[effective]) return vpPartZoneOverridesMap[effective];
  const custom = vpCustomPartsList.find(p => (p.name && p.name.toLowerCase() === (rawName || '').toLowerCase()) || (p.name && p.name.toLowerCase() === (effective || '').toLowerCase()));
  if (custom && custom.zoneId) return custom.zoneId;
  return defaultZoneId;
}

function vpIncrementPartUsage(name) {
  if (!name) return;
  const key = name.toLowerCase().trim();
  vpUsageStats[key] = (vpUsageStats[key] || 0) + 1;
}

function vpGetPartUsageScore(name, rawName) {
  const nLower = (name || '').toLowerCase().trim();
  const rLower = (rawName || '').toLowerCase().trim();
  let score = (vpUsageStats[nLower] || 0);
  if (rLower && rLower !== nLower) {
    score = Math.max(score, vpUsageStats[rLower] || 0);
  }

  // Analisa ocorrências reais em vistorias salvas no sistema
  if (typeof items !== 'undefined' && Array.isArray(items)) {
    items.forEach(it => {
      if (it.trocas && typeof it.trocas === 'string') {
        const tLower = it.trocas.toLowerCase();
        if (tLower.includes(nLower) || (rLower && tLower.includes(rLower))) score += 2;
      }
      if (it.reparos && typeof it.reparos === 'string') {
        const rLowerText = it.reparos.toLowerCase();
        if (rLowerText.includes(nLower) || (rLower && rLowerText.includes(rLower))) score += 2;
      }
    });
  }

  return score;
}

async function vpPushCatalogToCloud() {
  if (vpIsSyncingCloud) return;
  vpIsSyncingCloud = true;
  vpUpdateCloudIndicator('syncing', 'Salvando...');

  try {
    const payload = {
      data: {
        customParts: vpCustomPartsList,
        deletedParts: vpDeletedPartsList,
        renames: vpCustomPartRenamesMap,
        zoneOverrides: vpPartZoneOverridesMap,
        usageStats: vpUsageStats,
        updatedAt: Date.now()
      }
    };

    let success = false;
    for (const endpoint of VP_CLOUD_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          success = true;
          break;
        }
      } catch(e) {}
    }

    if (success) {
      vpUpdateCloudIndicator('synced', 'Salvo ✓');
      setTimeout(() => vpUpdateCloudIndicator('synced', 'Nuvem'), 2500);
    } else {
      vpUpdateCloudIndicator('idle', 'Nuvem');
    }
  } catch (err) {
    vpUpdateCloudIndicator('idle', 'Nuvem');
  } finally {
    vpIsSyncingCloud = false;
  }
}

window.vpSyncCatalogWithCloud = async function(showFeedback = false) {
  if (vpIsSyncingCloud) return;
  vpIsSyncingCloud = true;
  vpUpdateCloudIndicator('syncing', 'Sincronizando...');

  try {
    let cloudData = null;
    for (const endpoint of VP_CLOUD_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(endpoint + '?t=' + Date.now(), {
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (json && (json.data || json.customParts)) {
            cloudData = json.data || json;
            break;
          }
        }
      } catch(e) {}
    }

    if (cloudData) {
      let hasChanges = false;

      // 1. Merge de peças customizadas da nuvem
      if (Array.isArray(cloudData.customParts)) {
        cloudData.customParts.forEach(cloudPart => {
          if (!cloudPart || !cloudPart.name) return;
          const existsLocally = vpCustomPartsList.some(p => p.name.toLowerCase() === cloudPart.name.toLowerCase());
          if (!existsLocally) {
            vpCustomPartsList.push(cloudPart);
            hasChanges = true;
          }
        });
      }

      // 2. Merge de peças deletadas
      if (Array.isArray(cloudData.deletedParts)) {
        cloudData.deletedParts.forEach(delName => {
          if (delName && !vpDeletedPartsList.some(d => d.toLowerCase() === delName.toLowerCase())) {
            vpDeletedPartsList.push(delName);
            hasChanges = true;
          }
        });
      }

      // 3. Merge de renomeações
      if (cloudData.renames && typeof cloudData.renames === 'object') {
        Object.keys(cloudData.renames).forEach(orig => {
          if (!vpCustomPartRenamesMap[orig]) {
            vpCustomPartRenamesMap[orig] = cloudData.renames[orig];
            hasChanges = true;
          }
        });
      }

      // 4. Merge de alterações de zona
      if (cloudData.zoneOverrides && typeof cloudData.zoneOverrides === 'object') {
        Object.keys(cloudData.zoneOverrides).forEach(key => {
          if (!vpPartZoneOverridesMap[key]) {
            vpPartZoneOverridesMap[key] = cloudData.zoneOverrides[key];
            hasChanges = true;
          }
        });
      }

      // 5. Merge de estatísticas de uso
      if (cloudData.usageStats && typeof cloudData.usageStats === 'object') {
        Object.keys(cloudData.usageStats).forEach(k => {
          const cloudVal = cloudData.usageStats[k] || 0;
          if ((vpUsageStats[k] || 0) < cloudVal) {
            vpUsageStats[k] = cloudVal;
            hasChanges = true;
          }
        });
      }

      // Se temos peças locais que ainda não estavam na nuvem, faz push consolidado
      const localHasExtra = vpCustomPartsList.some(localP => {
        return !cloudData.customParts || !cloudData.customParts.some(cP => cP.name.toLowerCase() === localP.name.toLowerCase());
      });

      if (localHasExtra) {
        vpIsSyncingCloud = false;
        await vpPushCatalogToCloud();
      } else {
        vpSaveState(false);
        vpUpdateCloudIndicator('synced', 'Sincronizado ✓');
        setTimeout(() => vpUpdateCloudIndicator('synced', 'Nuvem'), 2500);
      }

      if (hasChanges) {
        vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
      }

      if (showFeedback) {
        alert('☁️ Catálogo online sincronizado com sucesso!');
      }
    } else {
      vpUpdateCloudIndicator('idle', 'Nuvem');
      if (showFeedback) {
        alert('Modo local ativo. Suas peças estão salvas neste aparelho.');
      }
    }
  } catch (err) {
    vpUpdateCloudIndicator('idle', 'Nuvem');
  } finally {
    vpIsSyncingCloud = false;
  }
};

function vpGetEffectivePartName(rawName) {
  let name = vpCustomPartRenamesMap[rawName] || rawName || '';
  return name
    .replace(/\bdianteir[oa]s?\b/gi, 'Diant.')
    .replace(/\btraseir[oa]s?\b/gi, 'Tras.');
}

function vpIsPartDeleted(rawName, effectiveName) {
  const eName = effectiveName || vpGetEffectivePartName(rawName);
  const rLower = (rawName || '').toLowerCase();
  const eLower = (eName || '').toLowerCase();
  return vpDeletedPartsList.some(d => {
    const dLower = (d || '').toLowerCase();
    return dLower === rLower || dLower === eLower;
  });
}

window.vpSetVehicleType = function(type, forceRender = true, keepAllZonesMode = false) {
  vpDetectedVehicleType = type;

  const btnCarro = document.getElementById('vpTypeBtn_carro');
  const btnMoto = document.getElementById('vpTypeBtn_moto');
  const btnPicape = document.getElementById('vpTypeBtn_picape');
  const btnCaminhao = document.getElementById('vpTypeBtn_caminhao');

  [btnCarro, btnMoto, btnPicape, btnCaminhao].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`vpTypeBtn_${type}`);
  if (activeBtn) activeBtn.classList.add('active');

  const headerIcon = document.getElementById('vpVehicleHeaderIcon');
  const typeBadge = document.getElementById('vpVehicleBadge');

  if (type === 'moto') {
    vpActiveZones = VP_BASE_ZONES_MOTO;
    vpActiveZoneId = 'dianteira_moto';
    if (headerIcon) headerIcon.textContent = '🏍️';
    if (typeBadge) typeBadge.textContent = '🏍️ Motocicleta';
  } else if (type === 'picape') {
    vpActiveZones = VP_BASE_ZONES_PICAPE;
    vpActiveZoneId = 'dianteira';
    if (headerIcon) headerIcon.textContent = '🛻';
    if (typeBadge) typeBadge.textContent = '🛻 Picape / Caminhonete';
  } else if (type === 'caminhao') {
    vpActiveZones = VP_BASE_ZONES_CAMINHAO;
    vpActiveZoneId = 'cabine_dianteira';
    if (headerIcon) headerIcon.textContent = '🚛';
    if (typeBadge) typeBadge.textContent = '🚛 Caminhão / Pesado';
  } else {
    vpDetectedVehicleType = 'carro';
    vpActiveZones = VP_BASE_ZONES_CAR;
    vpActiveZoneId = 'dianteira';
    if (headerIcon) headerIcon.textContent = '🚗';
    if (typeBadge) typeBadge.textContent = '🚗 Automóvel / SUV';
  }

  if (!keepAllZonesMode) {
    vpViewAllZonesMode = false;
  }

  if (forceRender) {
    vpUpdateTriggerButton();
    vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
  }
};

function vpDetectVehicleTypeFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return 'carro';
  
  let rawUpper = rawText.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Extrai placas brasileiras (antigas e Mercosul) para evitar colisões com siglas curtas de motos
  const platePattern = /\b[A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2}\b|\b[A-Z]{3}[-\s]?[0-9]{4}\b/g;
  let textWithoutPlates = rawUpper.replace(platePattern, ' ');

  const fullText = (' ' + textWithoutPlates.replace(/[^A-Z0-9\.\-\/]/g, ' ') + ' ').replace(/\s+/g, ' ');

  const hasWord = (term) => {
    const clean = (' ' + term.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ')
      .replace(/[^A-Z0-9\.\-\/]/g, ' ')
      .replace(/\s+/g, ' ');
    return fullText.includes(clean);
  };

  // 1. PICAPES E UTILITÁRIOS (Verificação prioritária)
  const picapeStrictTokens = [
    'HILUX', 'S10', 'S-10', 'MONTANA', 'SILVERADO', 'D20', 'D-20', 'D10', 'C10', 'C20', 'COLORADO',
    'RANGER', 'MAVERICK', 'F-150', 'F150', 'F-250', 'F250', 'COURIER',
    'STRADA', 'TORO', 'TITANO', 'FIORINO',
    'SAVEIRO', 'AMAROK', 'FRONTIER', 'L200', 'TRITON',
    'RAMPAGE', 'RAM 1500', 'RAM 2500', 'RAM 3500', 'OROCH', 'DUSTER OROCH',
    'LANDTREK', 'HOGGAR', 'JAC HUNTER', 'BYD SHARK', 'GWM POER',
    'CABINE DUPLA', 'CABINE SIMPLES', 'CABINE ESTENDIDA', 'CD 4X4', 'CS 4X4', 'PICKUP', 'PICK-UP', 'PICAPE'
  ];
  if (picapeStrictTokens.some(t => hasWord(t))) return 'picape';

  // 2. CAMINHÕES E PESADOS
  const caminhaoStrictTokens = [
    'CAMINHAO', 'CAMINHÃO', 'CAVALO MECANICO', 'CAVALO MECÂNICO', 'CAVALO-MECANICO',
    'BITREM', 'RODOTREM', 'CARRETA', 'SEMI-REBOQUE', 'SEMIRREBOQUE', 'BASCULANTE',
    'BITRUCK', 'TRUCK', 'CHASSI', 'CACAMBA', 'CAÇAMBA', 'GRANELEIRO', 'SIDER',
    'SCANIA', 'R440', 'R450', 'R480', 'R500', 'R540', 'P310', 'P360', 'P250', 'P270', 'P280', 'G440', '113H', '124G',
    'VOLVO FH', 'VOLVO FM', 'VOLVO FMX', 'VOLVO VM', 'FH 460', 'FH 500', 'FH 540', 'FH 420', 'FH 440', 'FH 520', 'FM 370', 'FM 380', 'VM 260', 'VM 270', 'VM 330',
    'ACTROS', 'ATEGO', 'ACCELO', 'AXOR', 'ATRON', 'AROCS', 'MB 1620', 'MB 1938', 'MB 1113', 'MB 710', '1620', '1938', '1113', '710', '2544', '2546', '2646', '2651', '2548', '2426', '2428', '1719', '815', '1016',
    'CONSTELLATION', 'DELIVERY', 'METEOR', 'WORKER', '24.250', '24.280', '25.440', '26.460', '19.320', '19.360', '17.190', '15.180', '13.180', '11.180', '9.170', '6.160',
    'STRALIS', 'HI-WAY', 'HI-ROAD', 'TECTOR', 'S-WAY', 'VERTIS', 'EUROCARGO', 'DAILY 70C', 'DAILY 35S',
    'DAF XF', 'DAF CF', 'DAF LF', 'XF105', 'XF 105', 'XF 480', 'XF 530', 'CF 85',
    'FORD CARGO', 'CARGO 815', 'CARGO 2428', 'CARGO 2422', 'CARGO 2429', 'CARGO 1722', 'CARGO 1719', 'CARGO 1932', 'F-4000', 'F4000',
    'MAN TGX', 'TGX 28.440'
  ];
  if (caminhaoStrictTokens.some(t => hasWord(t))) return 'caminhao';

  // 3. MOTOCICLETAS (Com termos precisos)
  const motoStrictTokens = [
    'MOTOCICLETA', 'MOTO', 'MOTONETA', 'SCOOTER', 'CICLOMOTOR', 'TRICICLO',
    'TITAN', 'FAN', 'START', 'BIZ', 'POP110', 'POP 110', 'POP100', 'POP 100',
    'BROS', 'NXR', 'XRE', 'XRE300', 'XRE 300', 'XRE190', 'XRE 190',
    'SAHARA', 'TORNADO', 'TWISTER', 'CB300', 'CB 300', 'CB 300F', 'CB300F',
    'CB500', 'CB 500', 'CB650', 'CB 650', 'CB1000', 'CB 1000', 'CBR', 'CBR600', 'CBR1000',
    'NC750', 'NC 750', 'NC700', 'TRANSALP', 'AFRICA TWIN', 'HORNET',
    'PCX', 'ADV150', 'ADV 150', 'ADV350', 'ADV 350', 'LEAD 110', 'SH150', 'SH 150', 'SH300', 'SH 300', 'FORZA',
    'CG160', 'CG 160', 'CG150', 'CG 150', 'CG125', 'CG 125', 'CG CARGO', 'FALCON', 'NX4', 'SHADOW',
    'FAZER', 'FZ15', 'FZ 15', 'FZ25', 'FZ 25', 'FZ6', 'FAZER 250', 'FAZER 150',
    'FACTOR', 'FACTOR 150', 'FACTOR 125', 'LANDER', 'XTZ', 'XTZ 250', 'XTZ 150', 'CROSSER',
    'TENERE', 'TENERE 250', 'TENERE 700', 'T7', 'MT-03', 'MT-07', 'MT-09', 'MT-10', 'MT03', 'MT07', 'MT09', 'MT10',
    'YZF-R3', 'YZF R3', 'YZF R15', 'YZF R1', 'NMAX', 'XMAX', 'FLUO', 'NEO 125', 'CRYPTON', 'YBR', 'VIRAGO', 'DRAGSTAR', 'MIDNIGHT STAR', 'RD 135', 'RD 350', 'DT 200',
    'BURGMAN', 'INTRUDER', 'YES 125', 'GSR 750', 'GSR 150', 'GSX-S', 'GSX-R', 'GSX', 'HAYABUSA', 'BANDIT', 'V-STROM', 'VSTROM', 'BOULEVARD', 'INAZUMA', 'GLADIUS',
    'NINJA', 'NINJA 300', 'NINJA 400', 'NINJA 650', 'NINJA 1000', 'ZX-6R', 'ZX-10R', 'ZX6R', 'ZX10R', 'Z400', 'Z 400', 'Z650', 'Z 650', 'Z900', 'Z 900', 'Z1000',
    'VERSYS', 'VERSYS 300', 'VERSYS 650', 'VERSYS 1000', 'VULCAN', 'KLX',
    'GS 1250', 'GS 1200', 'GS 1300', 'GS 850', 'GS 750', 'GS 310', 'G 310', 'G310GS', 'G310R', 'F850GS', 'F800GS', 'F750GS', 'F900R', 'F900XR', 'S1000RR', 'S1000R', 'R1250GS', 'R1200GS', 'R1300GS', 'R 1250 GS', 'R 1200 GS', 'R 1300 GS', 'R NINET',
    'TIGER', 'TIGER 900', 'TIGER 1200', 'TIGER 800', 'TIGER 660', 'BONNEVILLE', 'STREET TRIPLE', 'SPEED TRIPLE', 'TRIDENT', 'ROCKET 3',
    'HUNTER 350', 'METEOR 350', 'CLASSIC 350', 'HIMALAYAN', 'SCRAM 411', 'INTERCEPTOR 650', 'CONTINENTAL GT', 'SUPER METEOR', 'SHOTGUN 650',
    'PANIGALE', 'MULTISTRADA', 'DIAVEL', 'HYPERMOTARD', 'DESERTX', 'MONSTER 797', 'MONSTER 821', 'MONSTER 1200', 'STREETFIGHTER',
    'FAT BOY', 'HERITAGE', 'IRON 883', 'SPORTSTER', 'ROAD KING', 'STREET GLIDE', 'ULTRA LIMITED', 'BREAKOUT', 'NIGHTSTER', 'LOW RIDER', 'FAT BOB',
    'KTM DUKE', 'DUKE 200', 'DUKE 390', 'DUKE 790', 'ADVENTURE 390', 'ADVENTURE 890', 'ADVENTURE 1290',
    'DOMINAR', 'DOMINAR 400', 'DOMINAR 200', 'DOMINAR 160', 'PULSAR', 'CHETAK',
    'DR160', 'DR 160', 'CHOPPER ROAD', 'MASTER RIDE', 'DK150', 'DK 150', 'VR150', 'LINDY 125', 'NK150',
    'CITYCOM', 'MAXSYM', 'APACHE RTR', 'NH 190', 'NH 300', 'CRUISYM', 'HORIZON 150', 'HORIZON 250',
    'VOLTZ', 'EVS', 'EV1', 'WATTS W125', 'SUPER SOCO', 'MUVINX', 'JET 50', 'JET 125', 'PHOENIX 50', 'WORKER 125'
  ];

  const motoExclusiveBrands = [
    'TRIUMPH', 'DUCATI', 'ROYAL ENFIELD', 'HARLEY-DAVIDSON', 'HARLEY DAVIDSON', 'HARLEY',
    'BAJAJ', 'HAOJUE', 'DAFRA', 'SHINERAY', 'KASINSKI', 'SUNDOWN', 'TRAXX', 'VESPA', 'PIAGGIO',
    'MV AGUSTA', 'APRILIA', 'BENELLI', 'KTM', 'SUPER SOCO'
  ];

  if (motoStrictTokens.some(t => hasWord(t))) return 'moto';
  if (motoExclusiveBrands.some(b => hasWord(b))) return 'moto';

  // 4. PADRÃO É CARRO (cobre Duster, Onix, Gol, Corolla, BYD, GWM, etc.)
  return 'carro';
}
window.vpDetectVehicleTypeFromText = vpDetectVehicleTypeFromText;

let currentVistoriaIdForParts = null;
let vpOpenObsPartNames = new Set();
let vpActiveCategory = 'DIANTEIRA'; // 'DIANTEIRA' | 'TRASEIRA' | 'LATERAIS' | 'DEMAIS' | 'TODAS'

window.vpSelectCategory = function(categoryKey) {
  vpActiveCategory = categoryKey;
  vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
};

function vpClassifyPartCategory(item) {
  const zoneId = (item.zoneId || '').toLowerCase();
  const nameUpper = (item.name || item.rawName || '').toUpperCase();

  // 1. DIANTEIRA EXPLÍCITA (peças frontais que possuem LD/LE continuam na Dianteira)
  const isDiantExplicit = /\b(CAPO|CAPÔ|GRADE DIANT|GRADE FRONTAL|ALMA DO PARA-CHOQUE DIANT|ALMA DO PARACHOQUE DIANT|FAROL|FAROIS|FARÓIS|FAROL DE MILHA|PARA-LAMA DIANT|PARALAMA DIANT|PAINEL FRONTAL|MINI-FRENTE|MINI FRENTE|RADIADOR|CONDENSADOR|ELETROVENTILADOR|VENTOINHA|GUIA DO PARA-CHOQUE DIANT|GUIA DO PARACHOQUE DIANT|EMBLEMA FRONTAL|QUEBRA-SOL|TAPA-SOL|DEFLETOR DE AR|GUIDAO|GUIDÃO|GARFO DIANT|BENGALA|MESA SUPERIOR|MESA INFERIOR|PISCA DIANT|PARA-BRISA|PARABRISA)\b/i.test(nameUpper);

  if (isDiantExplicit) {
    return 'DIANTEIRA';
  }

  // 2. TRASEIRA EXPLÍCITA (peças traseiras que possuem LD/LE continuam na Traseira)
  const isTrasExplicit = /\b(PORTA-MALAS|PORTA MALAS|TAMPA TRAS|TAMPA DA CACAMBA|TAMPA DA CAÇAMBA|PARA-CHOQUE TRAS|PARACHOQUE TRAS|ALMA DO PARA-CHOQUE TRAS|ALMA DO PARACHOQUE TRAS|LANTERNA TRAS|LANTERNAS TRAS|LANTERNA TAMPA|REFLETOR TRAS|PAINEL TRAS|ASSOALHO DO PORTA-MALAS|ASSOALHO DA CACAMBA|ASSOALHO DA CAÇAMBA|GUIA DO PARA-CHOQUE TRAS|GUIA DO PARACHOQUE TRAS|EMBLEMA TRAS|PROTETOR DE CACAMBA|PROTETOR DE CAÇAMBA|SANTO ANTONIO|SANTO ANTÔNIO|CAPOTA MARITIMA|CAPOTA MARÍTIMA|ESTRIBO TRAS|RABETA TRAS|ESCAPAMENTO|PONTEIRA|PROTETOR DO ESCAPAMENTO|BALANCA TRAS|BALANÇA TRAS|ALCA TRAS|ALÇA TRAS|FAIXAS REFLETIVAS|PORTAS TRAS DO BAU|PORTAS TRAS DO BAÚ|ENGATE DE REBOQUE|VIGIA|VIDRO TRAS)\b/i.test(nameUpper);

  if (isTrasExplicit) {
    return 'TRASEIRA';
  }

  // 3. LATERAIS: Portas, retrovisores, vidros de portas, caixas de ar/soleiras, colunas A/B/C, laterais traseiras, frisos, maçanetas, estribos laterais, spoilers/saias laterais, forros de portas, carenagens laterais
  const isLateralZone = zoneId === 'lateral_dir' || zoneId === 'lateral_esq' || zoneId === 'portas_cabine';
  const isLateralKeyword = /\b(PORTA|PORTAS|RETROVISOR|RETROVISORES|ESPELHO DO RETROVISOR|CAPA DO RETROVISOR|BRACO DO RETROVISOR|BRAÇO DO RETROVISOR|CAIXA DE AR|SOLEIRA|COLUNA A|COLUNA B|COLUNA C|LATERAL TRAS|LATERAL EXTERNA|FRISO DA PORTA|FRISO DE PORTA|MACANETA|MAÇANETA|ESTRIBO LATERAL|ESTRIBO DE ACESSO|MOLDURA \/ ALARGADOR|ALARGADOR DE PARA-LAMA|SPOILER \/ SAIA LATERAL|SAIA LATERAL|VIDRO DA PORTA|VIDRO PORTA|FORRO DE PORTA|CARENAGEM LATERAL|TAMPA LATERAL)\b/i.test(nameUpper);

  if (isLateralKeyword || isLateralZone) {
    return 'LATERAIS';
  }

  // 4. DIANTEIRA GERAL
  const isDianteiraZone = zoneId === 'dianteira' || zoneId === 'dianteira_moto' || zoneId === 'cabine_dianteira';
  if (isDianteiraZone || /\b(DIANT|FRONTAL|DIANTEIR[OA])\b/i.test(nameUpper)) {
    return 'DIANTEIRA';
  }

  // 5. TRASEIRA GERAL
  const isTraseiraZone = zoneId === 'traseira' || zoneId === 'traseira_moto' || zoneId === 'traseira_cacamba' || zoneId === 'traseira_implemento';
  if (isTraseiraZone || /\b(TRAS|TRASEIR[OA]|TRASEIRA)\b/i.test(nameUpper)) {
    return 'TRASEIRA';
  }

  // 6. DEMAIS PEÇAS (Teto, Estrutura, Mecânica, Suspensão, Interior, Rodas, Pneus, Freios, etc.)
  return 'DEMAIS';
}

window.openVehiclePartsForVistoriaId = function(id) {
  const item = items.find(entry => entry.id === id);
  if (!item) return;

  currentVistoriaIdForParts = id;
  vpViewAllZonesMode = true;
  vpActiveCategory = 'DIANTEIRA';
  vpOpenObsPartNames.clear();
  vpLoadState();
  if (typeof window.vpSyncCatalogWithCloud === 'function') {
    window.vpSyncCatalogWithCloud(false);
  }

  const vehicleTitle = item.plate ? item.plate.trim() : '';
  vpCurrentVehicleModelName = vehicleTitle;

  const titleDisplay = document.getElementById('vpVehicleTitle');
  const detectedType = item.type === 'Moto' ? 'moto' : vpDetectVehicleTypeFromText(vehicleTitle);
  window.vpSetVehicleType(detectedType, false, true);
  vpViewAllZonesMode = true;

  if (titleDisplay) {
    titleDisplay.textContent = vehicleTitle || 'Partes do Veículo';
  }

  vpSelectedPartsMap.clear();

  const parseLines = (text, action) => {
    if (!text || typeof text !== 'string') return;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      let name = line;
      let obs = '';
      const match = line.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        name = match[1].trim();
        obs = match[2].trim();
      }
      if (name) {
        vpSelectedPartsMap.set(name, {
          name: name,
          rawName: name,
          zoneId: vpActiveZoneId,
          zoneName: 'Veículo',
          action: action,
          obs: obs
        });
      }
    });
  };

  if (item.type === 'Vistoria Rio log') {
    const avariasStr = (item.details && item.details.avarias) || item.avarias || '';
    parseLines(avariasStr, 'troca');
  } else {
    const trocasStr = (item.details && item.details.trocas) || item.trocas || '';
    const reparosStr = (item.details && item.details.reparos) || item.reparos || '';
    parseLines(trocasStr, 'troca');
    parseLines(reparosStr, 'reparo');
  }

  vpSetupSearch();
  vpUpdateTriggerButton();
  vpRenderParts();
  vpUpdateDockAndSheet();

  const modal = document.getElementById('vehiclePartsModal');
  if (modal) modal.style.display = 'flex';
};
window.openVehiclePartsModalForId = window.openVehiclePartsForVistoriaId;

window.openVehiclePartsModal = function() {
  currentVistoriaIdForParts = null;
  vpViewAllZonesMode = true;
  vpActiveCategory = 'DIANTEIRA';
  vpOpenObsPartNames.clear();
  vpLoadState();
  if (typeof window.vpSyncCatalogWithCloud === 'function') {
    window.vpSyncCatalogWithCloud(false);
  }

  const plateInput = document.getElementById('plateInput');
  const vehicleTitle = plateInput ? plateInput.value.trim() : '';
  vpCurrentVehicleModelName = vehicleTitle;

  const titleDisplay = document.getElementById('vpVehicleTitle');

  // Auto-detecção inteligente de tipo com catálogo completo de marcas e modelos
  const detectedType = (typeof selectedType !== 'undefined' && selectedType === 'Moto') ? 'moto' : vpDetectVehicleTypeFromText(vehicleTitle);

  // Aplica o tipo detectado e atualiza as abas
  window.vpSetVehicleType(detectedType, false, true);
  vpViewAllZonesMode = true;

  if (titleDisplay) {
    titleDisplay.textContent = vehicleTitle || 'Partes do Veículo';
  }

  // Lê os valores atuais dos textareas para sincronizar
  vpSelectedPartsMap.clear();

  const isRioLog = (typeof selectedType !== 'undefined' && selectedType === 'Vistoria Rio log');
  const avariasTextarea = document.querySelector('textarea[name="avarias"]');
  const trocasTextarea = document.querySelector('textarea[name="trocas"]');
  const reparosTextarea = document.querySelector('textarea[name="reparos"]');

  if (isRioLog && avariasTextarea && avariasTextarea.value) {
    const lines = avariasTextarea.value.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const match = trimmed.match(/^(.*?)\s*\((.*?)\)$/);
      const name = match ? match[1].trim() : trimmed;
      const obs = match ? match[2].trim() : '';
      vpSelectedPartsMap.set(name, {
        name: name,
        rawName: name,
        zoneId: vpActiveZoneId,
        zoneName: 'Veículo',
        action: 'troca',
        obs: obs
      });
    });
  } else {
    if (trocasTextarea && trocasTextarea.value) {
      const lines = trocasTextarea.value.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const match = trimmed.match(/^(.*?)\s*\((.*?)\)$/);
        const name = match ? match[1].trim() : trimmed;
        const obs = match ? match[2].trim() : '';
        vpSelectedPartsMap.set(name, {
          name: name,
          rawName: name,
          zoneId: vpActiveZoneId,
          zoneName: 'Veículo',
          action: 'troca',
          obs: obs
        });
      });
    }

    if (reparosTextarea && reparosTextarea.value) {
      const lines = reparosTextarea.value.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const match = trimmed.match(/^(.*?)\s*\((.*?)\)$/);
        const name = match ? match[1].trim() : trimmed;
        const obs = match ? match[2].trim() : '';
        vpSelectedPartsMap.set(name, {
          name: name,
          rawName: name,
          zoneId: vpActiveZoneId,
          zoneName: 'Veículo',
          action: 'reparo',
          obs: obs
        });
      });
    }
  }

  vpSetupSearch();
  vpUpdateTriggerButton();
  vpRenderParts();
  vpUpdateDockAndSheet();

  const modal = document.getElementById('vehiclePartsModal');
  if (modal) modal.style.display = 'flex';
};

window.closeVehiclePartsModal = function() {
  currentVistoriaIdForParts = null;
  const modal = document.getElementById('vehiclePartsModal');
  if (modal) modal.style.display = 'none';
};

window.vpOpenPhotosFromDock = function() {
  let vehicleName = (typeof vpCurrentVehicleModelName === 'string' && vpCurrentVehicleModelName.trim()) ? vpCurrentVehicleModelName.trim() : '';
  if (!vehicleName) {
    const plateInput = document.getElementById('plateInput');
    if (plateInput && plateInput.value) {
      vehicleName = plateInput.value.trim();
    }
  }
  if (!vehicleName) {
    const superInput = document.getElementById('supervisaoVehicleInput');
    if (superInput && superInput.value) {
      vehicleName = superInput.value.trim();
    }
  }
  const targetId = currentVistoriaIdForParts || (typeof editingId !== 'undefined' ? editingId : null) || (typeof editingSupervisaoId !== 'undefined' ? editingSupervisaoId : null) || 'active_vehicle_parts';
  if (!vehicleName) {
    vehicleName = 'Veículo';
  }
  if (typeof openPhotoManagerForVehicle === 'function') {
    openPhotoManagerForVehicle(targetId, vehicleName);
  } else if (typeof openPhotoManagerForId === 'function') {
    openPhotoManagerForId(targetId);
  }
};

window.vpApplyAndClose = function() {
  const trocasList = [];
  const reparosList = [];
  const allPartsList = [];

  for (const part of vpSelectedPartsMap.values()) {
    const formatted = part.obs ? `${part.name} (${part.obs})` : part.name;
    allPartsList.push(formatted);
    if (part.action === 'troca') {
      trocasList.push(formatted);
      vpIncrementPartUsage(part.name);
    } else if (part.action === 'reparo') {
      reparosList.push(formatted);
      vpIncrementPartUsage(part.name);
    }
  }

  if (vpSelectedPartsMap.size > 0) {
    vpSaveState(true);
  }

  if (currentVistoriaIdForParts) {
    const item = items.find(entry => entry.id === currentVistoriaIdForParts);
    if (item) {
      if (!item.details) item.details = {};
      if (item.type === 'Vistoria Rio log') {
        item.details.avarias = allPartsList.join('\n');
      } else {
        item.details.trocas = trocasList.join('\n');
        item.details.reparos = reparosList.join('\n');
      }
      item.updatedAt = new Date().toLocaleString('pt-BR');
      item.updatedAtTime = Date.now();
      saveItems();
      render();
      if (typeof updateLocalAndServerData === 'function') {
        updateLocalAndServerData();
      }
    }
    currentVistoriaIdForParts = null;
  }

  const isRioLog = (typeof selectedType !== 'undefined' && selectedType === 'Vistoria Rio log');
  const trocasTextarea = document.querySelector('textarea[name="trocas"]');
  const reparosTextarea = document.querySelector('textarea[name="reparos"]');
  const avariasTextarea = document.querySelector('textarea[name="avarias"]');

  if (isRioLog && avariasTextarea) {
    avariasTextarea.value = allPartsList.join('\n');
    avariasTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    avariasTextarea.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    if (trocasTextarea) {
      trocasTextarea.value = trocasList.join('\n');
      trocasTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      trocasTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (reparosTextarea) {
      reparosTextarea.value = reparosList.join('\n');
      reparosTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      reparosTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (avariasTextarea && !trocasTextarea && !reparosTextarea) {
      avariasTextarea.value = allPartsList.join('\n');
      avariasTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      avariasTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Exibe a tela com a mensagem no centro da tela por 3 segundos e só depois volta para a tela de vistoria
  showCenteredSuccessModal('Partes do veículo salvas na vistoria!', 3000, () => {
    window.closeVehiclePartsModal();
    window.vpCloseReviewSheet();
  });
};

function vpUpdateTriggerButton() {
  const currentZone = vpActiveZones.find(z => z.id === vpActiveZoneId) || vpActiveZones[0];
  const triggerIcon = document.getElementById('vpTriggerIcon');
  const triggerTitle = document.getElementById('vpTriggerTitle');
  const triggerBadge = document.getElementById('vpTriggerCountBadge');

  const categoryTitles = {
    'DIANTEIRA': 'Dianteira (LD, LE e Centrais)',
    'TRASEIRA': 'Traseira (LD, LE e Centrais)',
    'LATERAIS': 'Laterais (Todos os Lados)',
    'DEMAIS': 'Demais Peças (Teto, Mecânica, Interior)',
    'TODAS': 'Todas as Peças do Catálogo'
  };
  const categoryIcons = {
    'DIANTEIRA': '🚗',
    'TRASEIRA': '🚘',
    'LATERAIS': '↔️',
    'DEMAIS': '⚙️',
    'TODAS': '📋'
  };

  if (triggerIcon) triggerIcon.textContent = categoryIcons[vpActiveCategory] || '🚗';
  if (triggerTitle) triggerTitle.textContent = categoryTitles[vpActiveCategory] || 'Partes do Veículo';
  if (triggerBadge) {
    triggerBadge.style.display = vpSelectedPartsMap.size > 0 ? 'inline-block' : 'none';
    triggerBadge.textContent = vpSelectedPartsMap.size;
  }
}

function vpGetZoneSelectedCount(zoneId) {
  let c = 0;
  for (const part of vpSelectedPartsMap.values()) {
    if (part.zoneId === zoneId) c++;
  }
  return c;
}

window.vpOpenZonesGridModal = function() {
  const modal = document.getElementById('vpZonesGridModal');
  const grid = document.getElementById('vpZonesGridContent');
  const btnAll = document.getElementById('vpViewAllBtnText');

  if (btnAll) {
    btnAll.textContent = '👁️ Ver Todas as Peças do Catálogo';
  }

  if (grid) {
    grid.innerHTML = `
      <button type="button" class="vp-zone-card ${vpActiveCategory === 'DIANTEIRA' ? 'active' : ''}" onclick="vpSelectCategory('DIANTEIRA'); vpCloseZonesGridModal();">
        <span class="vp-zone-icon">🚗</span>
        <div class="vp-zone-info">
          <strong>Dianteira</strong>
          <span>Todas da frente (LD/LE)</span>
        </div>
      </button>
      <button type="button" class="vp-zone-card ${vpActiveCategory === 'TRASEIRA' ? 'active' : ''}" onclick="vpSelectCategory('TRASEIRA'); vpCloseZonesGridModal();">
        <span class="vp-zone-icon">🚘</span>
        <div class="vp-zone-info">
          <strong>Traseira</strong>
          <span>Todas de trás (LD/LE)</span>
        </div>
      </button>
      <button type="button" class="vp-zone-card ${vpActiveCategory === 'LATERAIS' ? 'active' : ''}" onclick="vpSelectCategory('LATERAIS'); vpCloseZonesGridModal();">
        <span class="vp-zone-icon">↔️</span>
        <div class="vp-zone-info">
          <strong>Laterais</strong>
          <span>Portas, espelhos, saias</span>
        </div>
      </button>
      <button type="button" class="vp-zone-card ${vpActiveCategory === 'DEMAIS' ? 'active' : ''}" onclick="vpSelectCategory('DEMAIS'); vpCloseZonesGridModal();">
        <span class="vp-zone-icon">⚙️</span>
        <div class="vp-zone-info">
          <strong>Demais Peças</strong>
          <span>Teto, mecânica, interior</span>
        </div>
      </button>
    `;
  }

  if (modal) modal.style.display = 'flex';
};

window.vpCloseZonesGridModal = function() {
  const modal = document.getElementById('vpZonesGridModal');
  if (modal) modal.style.display = 'none';
};

window.vpHandleZonesOverlayClick = function(e) {
  if (e.target.id === 'vpZonesGridModal') {
    window.vpCloseZonesGridModal();
  }
};

window.vpSelectZone = function(zoneId) {
  window.vpCloseZonesGridModal();
  vpUpdateTriggerButton();
  vpRenderParts();
};

window.vpToggleViewAllZones = function() {
  vpActiveCategory = 'TODAS';
  window.vpCloseZonesGridModal();
  vpUpdateTriggerButton();
  vpRenderParts();
};

const VP_DEFAULT_POPULAR_KEYWORDS = [
  'farol', 'para-choque', 'parachoque', 'para-lama', 'paralama', 'capô', 'capo',
  'porta dianteira', 'porta traseira', 'porta', 'retrovisor', 'lanterna', 'para-brisa',
  'parabrisa', 'grade', 'tampa traseira', 'tampa do porta', 'painel frontal', 'alma do para',
  'radiador', 'amortecedor', 'balança', 'bandeja', 'bieleta', 'terminal', 'caixa de roda',
  'para-barro', 'parabarro', 'espelho', 'vidro'
];

function vpGetPartUsageScore(partName, rawName = '') {
  let score = 0;
  const lower = ((partName || '') + ' ' + (rawName || '')).toLowerCase();
  
  // 1. Pontuação base por relevância/frequência de uso em vistorias automotivas
  for (let i = 0; i < VP_DEFAULT_POPULAR_KEYWORDS.length; i++) {
    if (lower.includes(VP_DEFAULT_POPULAR_KEYWORDS[i])) {
      score += (VP_DEFAULT_POPULAR_KEYWORDS.length - i) * 10;
      break;
    }
  }

  // 2. Pontuação adicional por histórico de uso real salvo no dispositivo
  try {
    const stats = JSON.parse(localStorage.getItem('vp_parts_usage_stats') || '{}');
    if (stats[partName]) {
      score += stats[partName] * 25;
    }
  } catch(e) {}

  return score;
}

function vpIncrementPartUsage(partName) {
  if (!partName) return;
  try {
    const stats = JSON.parse(localStorage.getItem('vp_parts_usage_stats') || '{}');
    stats[partName] = (stats[partName] || 0) + 1;
    localStorage.setItem('vp_parts_usage_stats', JSON.stringify(stats));
  } catch(e) {}
}

function vpRenderParts(filterQuery = '') {
  const listEl = document.getElementById('vpPartsScrollContainer');
  if (!listEl) return;

  const matchesVehicleType = (p) => {
    return !p.vehicleType || p.vehicleType === 'all' || p.vehicleType === vpDetectedVehicleType;
  };

  const sortPartsByUsage = (partList) => {
    return partList.sort((a, b) => {
      const isSelA = vpSelectedPartsMap.has(a.name) ? 1 : 0;
      const isSelB = vpSelectedPartsMap.has(b.name) ? 1 : 0;
      if (isSelB !== isSelA) return isSelB - isSelA; // 1º: Selecionadas na sessão sempre no topo

      const scoreA = vpGetPartUsageScore(a.name, a.rawName);
      const scoreB = vpGetPartUsageScore(b.name, b.rawName);
      if (scoreB !== scoreA) return scoreB - scoreA; // 2º: Peças mais usadas/populares sempre no topo

      return a.name.localeCompare(b.name, 'pt-BR'); // 3º: Ordem alfabética para desempate
    });
  };

  // 1. BUSCA POR TEXTO (MOSTRA RESULTADOS EM LARGURA TOTAL)
  if (filterQuery.trim()) {
    const q = filterQuery.trim().toLowerCase();
    let matching = [];
    vpActiveZones.forEach(z => {
      z.parts.forEach(rawP => {
        const effective = vpGetEffectivePartName(rawP);
        if (!vpIsPartDeleted(rawP, effective)) {
          if (effective.toLowerCase().includes(q) || rawP.toLowerCase().includes(q)) {
            const actualZoneId = vpGetPartEffectiveZoneId(rawP, z.id);
            const zObj = vpActiveZones.find(zone => zone.id === actualZoneId) || z;
            matching.push({ rawName: rawP, name: effective, zoneId: actualZoneId, zoneName: zObj.name, icon: zObj.icon });
          }
        }
      });
    });
    vpCustomPartsList.forEach(p => {
      if (matchesVehicleType(p)) {
        const effective = vpGetEffectivePartName(p.name);
        if (!vpIsPartDeleted(p.name, effective)) {
          if (effective.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
            const actualZoneId = vpGetPartEffectiveZoneId(p.name, p.zoneId);
            const zObj = vpActiveZones.find(zone => zone.id === actualZoneId);
            matching.push({ rawName: p.name, name: effective, zoneId: actualZoneId, zoneName: zObj ? zObj.name : 'Personalizada', icon: zObj ? zObj.icon : '✨' });
          }
        }
      }
    });

    if (matching.length === 0) {
      listEl.innerHTML = `
        <div style="width: 100%; padding: 30px 16px; text-align: center; color: #64748b;">
          <span style="font-size: 1.8rem; display: block; margin-bottom: 6px;">🔍</span>
          <b>Nenhuma peça encontrada para "${vpEscapeHtml(filterQuery)}"</b>
          <p style="font-size: 0.80rem; margin-top: 4px;">Toque no botão "+ Nova Peça" acima para cadastrá-la no catálogo.</p>
        </div>
      `;
      return;
    }

    sortPartsByUsage(matching);
    listEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
        <div style="font-size: 0.74rem; font-weight: 700; color: #475569; padding: 2px 4px;">
          Encontradas ${matching.length} peças para "${vpEscapeHtml(filterQuery)}":
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; width: 100%;">
          ${matching.map(item => vpRenderPartCardHtml(item)).join('')}
        </div>
      </div>
    `;
    return;
  }

  // 2. VISUALIZAÇÃO PADRÃO DIVIDIDA EM 5 CATEGORIAS: DIANTEIRA, TRASEIRA, LATERAIS, DEMAIS E TODAS
  let allParts = [];
  const seenNames = new Set();

  vpActiveZones.forEach(z => {
    z.parts.forEach(rawP => {
      const effective = vpGetEffectivePartName(rawP);
      if (!vpIsPartDeleted(rawP, effective) && !seenNames.has(effective)) {
        seenNames.add(effective);
        const actualZoneId = vpGetPartEffectiveZoneId(rawP, z.id);
        const zObj = vpActiveZones.find(zone => zone.id === actualZoneId) || z;
        allParts.push({ rawName: rawP, name: effective, zoneId: actualZoneId, zoneName: zObj.name, icon: zObj.icon });
      }
    });
  });

  vpCustomPartsList.forEach(p => {
    if (matchesVehicleType(p)) {
      const effective = vpGetEffectivePartName(p.name);
      if (!vpIsPartDeleted(p.name, effective) && !seenNames.has(effective)) {
        seenNames.add(effective);
        const actualZoneId = vpGetPartEffectiveZoneId(p.name, p.zoneId);
        const zObj = vpActiveZones.find(zone => zone.id === actualZoneId);
        allParts.push({ rawName: p.name, name: effective, zoneId: actualZoneId, zoneName: zObj ? zObj.name : 'Personalizada', icon: zObj ? zObj.icon : '✨' });
      }
    }
  });

  const diantParts = allParts.filter(p => vpClassifyPartCategory(p) === 'DIANTEIRA');
  const trasParts = allParts.filter(p => vpClassifyPartCategory(p) === 'TRASEIRA');
  const latParts = allParts.filter(p => vpClassifyPartCategory(p) === 'LATERAIS');
  const demaisParts = allParts.filter(p => vpClassifyPartCategory(p) === 'DEMAIS');
  const todasParts = [...allParts];

  sortPartsByUsage(diantParts);
  sortPartsByUsage(trasParts);
  sortPartsByUsage(latParts);
  sortPartsByUsage(demaisParts);
  sortPartsByUsage(todasParts);

  const diantSelCount = diantParts.filter(p => vpSelectedPartsMap.has(p.name)).length;
  const trasSelCount = trasParts.filter(p => vpSelectedPartsMap.has(p.name)).length;
  const latSelCount = latParts.filter(p => vpSelectedPartsMap.has(p.name)).length;
  const demaisSelCount = demaisParts.filter(p => vpSelectedPartsMap.has(p.name)).length;
  const todasSelCount = todasParts.filter(p => vpSelectedPartsMap.has(p.name)).length;

  let activeList = diantParts;
  let activeTitle = 'Dianteira (LD, LE e Centrais)';
  let activeIcon = '🚗';
  let activeColor = '#2563eb';
  let activeBg = '#eff6ff';

  if (vpActiveCategory === 'TRASEIRA') {
    activeList = trasParts;
    activeTitle = 'Traseira (LD, LE e Centrais)';
    activeIcon = '🚘';
    activeColor = '#ea580c';
    activeBg = '#fff7ed';
  } else if (vpActiveCategory === 'LATERAIS') {
    activeList = latParts;
    activeTitle = 'Laterais (Todos os Lados)';
    activeIcon = '↔️';
    activeColor = '#16a34a';
    activeBg = '#f0fdf4';
  } else if (vpActiveCategory === 'DEMAIS') {
    activeList = demaisParts;
    activeTitle = 'Demais Peças (Teto, Mecânica, Interior)';
    activeIcon = '⚙️';
    activeColor = '#9333ea';
    activeBg = '#fdf4ff';
  } else if (vpActiveCategory === 'TODAS') {
    activeList = todasParts;
    activeTitle = 'Todas as Peças do Catálogo';
    activeIcon = '📋';
    activeColor = '#0f766e';
    activeBg = '#f0fdfa';
  }

  sortPartsByUsage(activeList);
  const selectedInActive = activeList.filter(p => vpSelectedPartsMap.has(p.name));
  const unselectedInActive = activeList.filter(p => !vpSelectedPartsMap.has(p.name));

  listEl.innerHTML = `
    <div class="vp-category-section-wrapper" style="display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;">
      <!-- AS 5 ABAS DE CATEGORIAS: DIANTEIRA, TRASEIRA, LATERAIS, DEMAIS E TODAS -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; width: 100%; box-sizing: border-box;">
        <!-- DIANTEIRA -->
        <button 
          type="button" 
          onclick="vpSelectCategory('DIANTEIRA')"
          title="Dianteira (inclusive LD e LE)"
          style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 44px; padding: 4px 1px; border-radius: 8px; border: 2px solid ${vpActiveCategory === 'DIANTEIRA' ? '#2563eb' : '#cbd5e1'}; background: ${vpActiveCategory === 'DIANTEIRA' ? '#eff6ff' : '#ffffff'}; cursor: pointer; transition: all 0.15s ease; box-sizing: border-box; box-shadow: ${vpActiveCategory === 'DIANTEIRA' ? '0 2px 6px rgba(37,99,235,0.18)' : 'none'};"
        >
          <span style="font-size: 0.85rem; line-height: 1;">🚗</span>
          <span style="font-size: 0.68rem; font-weight: 800; color: ${vpActiveCategory === 'DIANTEIRA' ? '#1e3a8a' : '#475569'}; line-height: 1.1;">Diant.</span>
          <div style="display: flex; align-items: center; gap: 2px;">
            <span style="font-size: 0.60rem; font-weight: 800; color: ${vpActiveCategory === 'DIANTEIRA' ? '#2563eb' : '#64748b'}; background: ${vpActiveCategory === 'DIANTEIRA' ? '#dbeafe' : '#f1f5f9'}; padding: 0.5px 3px; border-radius: 999px;">${diantParts.length}</span>
            ${diantSelCount > 0 ? `<span style="font-size: 0.58rem; font-weight: 800; color: #ffffff; background: #dc2626; padding: 0.5px 3px; border-radius: 999px;">${diantSelCount}</span>` : ''}
          </div>
        </button>

        <!-- TRASEIRA -->
        <button 
          type="button" 
          onclick="vpSelectCategory('TRASEIRA')"
          title="Traseira (inclusive LD e LE)"
          style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 44px; padding: 4px 1px; border-radius: 8px; border: 2px solid ${vpActiveCategory === 'TRASEIRA' ? '#ea580c' : '#cbd5e1'}; background: ${vpActiveCategory === 'TRASEIRA' ? '#fff7ed' : '#ffffff'}; cursor: pointer; transition: all 0.15s ease; box-sizing: border-box; box-shadow: ${vpActiveCategory === 'TRASEIRA' ? '0 2px 6px rgba(234,88,12,0.18)' : 'none'};"
        >
          <span style="font-size: 0.85rem; line-height: 1;">🚘</span>
          <span style="font-size: 0.68rem; font-weight: 800; color: ${vpActiveCategory === 'TRASEIRA' ? '#9a3412' : '#475569'}; line-height: 1.1;">Tras.</span>
          <div style="display: flex; align-items: center; gap: 2px;">
            <span style="font-size: 0.60rem; font-weight: 800; color: ${vpActiveCategory === 'TRASEIRA' ? '#ea580c' : '#64748b'}; background: ${vpActiveCategory === 'TRASEIRA' ? '#ffedd5' : '#f1f5f9'}; padding: 0.5px 3px; border-radius: 999px;">${trasParts.length}</span>
            ${trasSelCount > 0 ? `<span style="font-size: 0.58rem; font-weight: 800; color: #ffffff; background: #dc2626; padding: 0.5px 3px; border-radius: 999px;">${trasSelCount}</span>` : ''}
          </div>
        </button>

        <!-- LATERAIS -->
        <button 
          type="button" 
          onclick="vpSelectCategory('LATERAIS')"
          title="Laterais (independente do lado)"
          style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 44px; padding: 4px 1px; border-radius: 8px; border: 2px solid ${vpActiveCategory === 'LATERAIS' ? '#16a34a' : '#cbd5e1'}; background: ${vpActiveCategory === 'LATERAIS' ? '#f0fdf4' : '#ffffff'}; cursor: pointer; transition: all 0.15s ease; box-sizing: border-box; box-shadow: ${vpActiveCategory === 'LATERAIS' ? '0 2px 6px rgba(22,163,74,0.18)' : 'none'};"
        >
          <span style="font-size: 0.85rem; line-height: 1;">↔️</span>
          <span style="font-size: 0.68rem; font-weight: 800; color: ${vpActiveCategory === 'LATERAIS' ? '#166534' : '#475569'}; line-height: 1.1;">Laterais</span>
          <div style="display: flex; align-items: center; gap: 2px;">
            <span style="font-size: 0.60rem; font-weight: 800; color: ${vpActiveCategory === 'LATERAIS' ? '#16a34a' : '#64748b'}; background: ${vpActiveCategory === 'LATERAIS' ? '#dcfce7' : '#f1f5f9'}; padding: 0.5px 3px; border-radius: 999px;">${latParts.length}</span>
            ${latSelCount > 0 ? `<span style="font-size: 0.58rem; font-weight: 800; color: #ffffff; background: #dc2626; padding: 0.5px 3px; border-radius: 999px;">${latSelCount}</span>` : ''}
          </div>
        </button>

        <!-- DEMAIS PEÇAS -->
        <button 
          type="button" 
          onclick="vpSelectCategory('DEMAIS')"
          title="Demais peças (não dianteira, traseira ou laterais)"
          style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 44px; padding: 4px 1px; border-radius: 8px; border: 2px solid ${vpActiveCategory === 'DEMAIS' ? '#9333ea' : '#cbd5e1'}; background: ${vpActiveCategory === 'DEMAIS' ? '#fdf4ff' : '#ffffff'}; cursor: pointer; transition: all 0.15s ease; box-sizing: border-box; box-shadow: ${vpActiveCategory === 'DEMAIS' ? '0 2px 6px rgba(147,51,234,0.18)' : 'none'};"
        >
          <span style="font-size: 0.85rem; line-height: 1;">⚙️</span>
          <span style="font-size: 0.68rem; font-weight: 800; color: ${vpActiveCategory === 'DEMAIS' ? '#6b21a8' : '#475569'}; line-height: 1.1;">Demais</span>
          <div style="display: flex; align-items: center; gap: 2px;">
            <span style="font-size: 0.60rem; font-weight: 800; color: ${vpActiveCategory === 'DEMAIS' ? '#9333ea' : '#64748b'}; background: ${vpActiveCategory === 'DEMAIS' ? '#fae8ff' : '#f1f5f9'}; padding: 0.5px 3px; border-radius: 999px;">${demaisParts.length}</span>
            ${demaisSelCount > 0 ? `<span style="font-size: 0.58rem; font-weight: 800; color: #ffffff; background: #dc2626; padding: 0.5px 3px; border-radius: 999px;">${demaisSelCount}</span>` : ''}
          </div>
        </button>

        <!-- TODAS AS PEÇAS -->
        <button 
          type="button" 
          onclick="vpSelectCategory('TODAS')"
          title="Todas as peças"
          style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 44px; padding: 4px 1px; border-radius: 8px; border: 2px solid ${vpActiveCategory === 'TODAS' ? '#0f766e' : '#cbd5e1'}; background: ${vpActiveCategory === 'TODAS' ? '#f0fdfa' : '#ffffff'}; cursor: pointer; transition: all 0.15s ease; box-sizing: border-box; box-shadow: ${vpActiveCategory === 'TODAS' ? '0 2px 6px rgba(15,118,110,0.18)' : 'none'};"
        >
          <span style="font-size: 0.85rem; line-height: 1;">📋</span>
          <span style="font-size: 0.68rem; font-weight: 800; color: ${vpActiveCategory === 'TODAS' ? '#115e59' : '#475569'}; line-height: 1.1;">Todas</span>
          <div style="display: flex; align-items: center; gap: 2px;">
            <span style="font-size: 0.60rem; font-weight: 800; color: ${vpActiveCategory === 'TODAS' ? '#0f766e' : '#64748b'}; background: ${vpActiveCategory === 'TODAS' ? '#ccfbf1' : '#f1f5f9'}; padding: 0.5px 3px; border-radius: 999px;">${todasParts.length}</span>
            ${todasSelCount > 0 ? `<span style="font-size: 0.58rem; font-weight: 800; color: #ffffff; background: #dc2626; padding: 0.5px 3px; border-radius: 999px;">${todasSelCount}</span>` : ''}
          </div>
        </button>
      </div>

      <!-- CABEÇALHO DA CATEGORIA ATIVA -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; background: ${activeBg}; border-radius: 8px; border-left: 4px solid ${activeColor};">
        <div style="display: flex; align-items: center; gap: 5px;">
          <span style="font-size: 0.95rem;">${activeIcon}</span>
          <strong style="font-size: 0.80rem; color: #0f172a;">${activeTitle}</strong>
        </div>
        <span style="font-size: 0.68rem; font-weight: 800; color: ${activeColor}; background: #ffffff; padding: 2px 6px; border-radius: 999px; border: 1px solid #cbd5e1;">
          ${activeList.length} peças
        </span>
      </div>

      <!-- SEÇÃO SUSPENSA NO TOPO: PEÇAS SELECIONADAS (2 COLUNAS) -->
      ${selectedInActive.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 5px; width: 100%; padding: 6px; background: #fef2f2; border: 1.5px dashed #f87171; border-radius: 8px; box-sizing: border-box;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 0.90rem;">📌</span>
              <strong style="font-size: 0.76rem; color: #991b1b;">Selecionadas (${selectedInActive.length})</strong>
            </div>
            <span style="font-size: 0.62rem; color: #b91c1c; font-weight: 800; background: #fee2e2; padding: 1px 5px; border-radius: 999px;">Fixadas</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; width: 100%; box-sizing: border-box;">
            ${selectedInActive.map(item => vpRenderPartCardHtml(item)).join('')}
          </div>
        </div>
      ` : ''}

      <!-- RESTANTE DO CATÁLOGO DE PEÇAS (2 COLUNAS) -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; width: 100%; box-sizing: border-box;">
        ${unselectedInActive.map(item => vpRenderPartCardHtml(item)).join('')}
      </div>
    </div>
  `;
}

function vpRenderPartCardHtml(item) {
  const selected = vpSelectedPartsMap.get(item.name);
  const isTroca = selected && selected.action === 'troca';
  const isReparo = selected && selected.action === 'reparo';
  const hasObs = selected && selected.obs && selected.obs.trim().length > 0;
  const isObsOpen = vpOpenObsPartNames.has(item.name) || hasObs;
  const cardClass = isTroca ? 'selected-troca' : (isReparo ? 'selected-reparo' : '');

  return `
    <div class="vp-part-card ${cardClass}" style="width: 100%; min-width: 0; box-sizing: border-box; padding: 6px 6px; border-radius: 8px; border: 1.5px solid ${isTroca ? '#dc2626' : (isReparo ? '#0284c7' : '#cbd5e1')}; background: ${isTroca ? '#fffafa' : (isReparo ? '#f0f9ff' : '#ffffff')}; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
      <!-- 1ª LINHA: [❌ Excluir] [Descrição da Peça] [✏️ Editar] -->
      <div class="vp-card-top" style="display: flex; align-items: center; justify-content: space-between; gap: 2px; width: 100%; min-width: 0;">
        <button type="button" class="vp-btn-delete-part" title="Excluir peça do catálogo" onclick="vpDeletePart('${vpEscapeHtml(item.rawName)}', '${vpEscapeHtml(item.name)}')">✖</button>
        <span class="vp-part-title" title="${vpEscapeHtml(item.name)}" style="font-size: 0.78rem; font-weight: 800; color: #0f172a; flex: 1; min-width: 0; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${vpEscapeHtml(item.name)}</span>
        <button type="button" class="vp-btn-edit-name" title="Editar nome e zona da peça" onclick="vpOpenEditPartModal('${vpEscapeHtml(item.rawName)}', '${vpEscapeHtml(item.name)}', '${item.zoneId}')">✏️</button>
      </div>

      <!-- 2ª LINHA: [Trocar (40%)] [Reparar (40%)] [Obs. (20%)] (SEM ÍCONES, SEM QUEBRA DE LINHA) -->
      <div class="vp-card-actions" style="display: flex; gap: 2px; width: 100%;">
        <button 
          type="button" 
          class="vp-btn-action btn-trocar ${isTroca ? 'active' : ''}" 
          style="flex: 0 0 40%; width: 40%; padding: 5px 1px; font-size: 0.74rem; min-height: 28px; border-radius: 6px; font-weight: 800; white-space: nowrap;"
          onclick="vpToggleAction('${vpEscapeHtml(item.name)}', '${item.zoneId}', '${vpEscapeHtml(item.zoneName)}', 'troca', '${vpEscapeHtml(item.rawName)}')"
        >
          Trocar
        </button>
        
        <button 
          type="button" 
          class="vp-btn-action btn-reparar ${isReparo ? 'active' : ''}" 
          style="flex: 0 0 40%; width: 40%; padding: 5px 1px; font-size: 0.74rem; min-height: 28px; border-radius: 6px; font-weight: 800; white-space: nowrap;"
          onclick="vpToggleAction('${vpEscapeHtml(item.name)}', '${item.zoneId}', '${vpEscapeHtml(item.zoneName)}', 'reparo', '${vpEscapeHtml(item.rawName)}')"
        >
          Reparar
        </button>

        <button 
          type="button" 
          class="vp-btn-action btn-obs ${hasObs ? 'has-obs active' : ''}" 
          style="flex: 0 0 20%; width: 20%; padding: 5px 1px; font-size: 0.72rem; min-height: 28px; border-radius: 6px; font-weight: 800; white-space: nowrap; background: ${hasObs ? '#eff6ff' : '#f8fafc'}; color: ${hasObs ? '#2563eb' : '#64748b'}; border-color: ${hasObs ? '#93c5fd' : '#cbd5e1'};"
          title="${hasObs ? 'Obs: ' + vpEscapeHtml(selected.obs) : 'Adicionar Observação'}"
          onclick="vpToggleObsBox('${vpEscapeHtml(item.name)}')"
        >
          Obs.
        </button>
      </div>

      <!-- COMBO / CAMPO DE OBSERVAÇÃO (OCULTO POR PADRÃO, ABRE AO CLICAR EM OBS) -->
      ${isObsOpen ? `
        <div class="vp-inline-obs-box" style="display: flex; flex-direction: column; gap: 4px; margin-top: 3px; padding: 5px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px;">
          <div style="display: flex; gap: 2px; flex-wrap: wrap;">
            ${['Pintura', 'Recuperar', 'Amassado', 'Riscado', 'Trincado', 'Quebrado', 'Desalinhado'].map(quick => `
              <button type="button" onclick="vpSetQuickObs('${vpEscapeHtml(item.name)}', '${quick}', '${item.zoneId}', '${vpEscapeHtml(item.zoneName)}', '${vpEscapeHtml(item.rawName)}')" style="font-size: 0.62rem; font-weight: 700; padding: 2px 4px; border-radius: 4px; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; cursor: pointer;">
                ${quick}
              </button>
            `).join('')}
          </div>
          <input 
            type="text" 
            class="vp-inline-obs-input" 
            placeholder="Obs..." 
            value="${vpEscapeHtml((selected && selected.obs) || '')}" 
            oninput="vpChangeObs('${vpEscapeHtml(item.name)}', this.value, '${item.zoneId}', '${vpEscapeHtml(item.zoneName)}', '${vpEscapeHtml(item.rawName)}')"
            style="width: 100%; box-sizing: border-box; padding: 4px 6px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 0.72rem;"
          />
        </div>
      ` : ''}
    </div>
  `;
}

window.vpToggleObsBox = function(partName) {
  if (vpOpenObsPartNames.has(partName)) {
    vpOpenObsPartNames.delete(partName);
  } else {
    vpOpenObsPartNames.add(partName);
  }
  vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
};

window.vpSetQuickObs = function(partName, quickText, zoneId, zoneName, rawName = '') {
  let item = vpSelectedPartsMap.get(partName);
  if (!item) {
    item = {
      name: partName,
      rawName: rawName || partName,
      zoneId: zoneId || vpActiveZoneId,
      zoneName: zoneName || 'Veículo',
      action: 'reparo',
      obs: quickText
    };
    vpSelectedPartsMap.set(partName, item);
  } else {
    item.obs = quickText;
  }
  vpSaveState();
  vpUpdateTriggerButton();
  vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
  vpUpdateDockAndSheet();
};

window.vpToggleAction = function(partName, zoneId, zoneName, action, rawName = '') {
  const current = vpSelectedPartsMap.get(partName);

  if (current && current.action === action) {
    vpSelectedPartsMap.delete(partName);
  } else {
    vpSelectedPartsMap.set(partName, {
      name: partName,
      rawName: rawName || partName,
      zoneId: zoneId,
      zoneName: zoneName,
      action: action,
      obs: current ? (current.obs || '') : ''
    });
  }

  vpSaveState();
  vpUpdateTriggerButton();
  vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
  vpUpdateDockAndSheet();
};

window.vpChangeObs = function(partName, obsText, zoneId, zoneName, rawName = '') {
  let item = vpSelectedPartsMap.get(partName);
  if (!item && obsText.trim()) {
    item = {
      name: partName,
      rawName: rawName || partName,
      zoneId: zoneId || vpActiveZoneId,
      zoneName: zoneName || 'Veículo',
      action: 'reparo',
      obs: obsText.trim()
    };
    vpSelectedPartsMap.set(partName, item);
  } else if (item) {
    item.obs = obsText.trim();
  }
  vpSaveState();
  vpUpdateDockAndSheet();
};

window.vpRemoveSelected = function(partName) {
  if (vpSelectedPartsMap.has(partName)) {
    vpSelectedPartsMap.delete(partName);
    vpSaveState();
    vpUpdateTriggerButton();
    vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
    vpUpdateDockAndSheet();
  }
};

window.vpClearAllSelected = function() {
  if (vpSelectedPartsMap.size === 0) return;
  if (confirm('Deseja realmente desmarcar todas as peças selecionadas?')) {
    vpSelectedPartsMap.clear();
    vpSaveState();
    vpUpdateTriggerButton();
    vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
    vpUpdateDockAndSheet();
    window.vpCloseReviewSheet();
  }
};

function vpUpdateDockAndSheet() {
  const trocas = [];
  const reparos = [];

  for (const part of vpSelectedPartsMap.values()) {
    if (part.action === 'troca') trocas.push(part);
    else if (part.action === 'reparo') reparos.push(part);
  }

  const dockTroca = document.getElementById('vpDockTrocaCount');
  const dockReparo = document.getElementById('vpDockReparoCount');
  const sheetTrocasCount = document.getElementById('vpSheetTrocasCount');
  const sheetReparosCount = document.getElementById('vpSheetReparosCount');

  if (dockTroca) dockTroca.textContent = trocas.length;
  if (dockReparo) dockReparo.textContent = reparos.length;
  if (sheetTrocasCount) sheetTrocasCount.textContent = trocas.length;
  if (sheetReparosCount) sheetReparosCount.textContent = reparos.length;

  // Sheet lists
  const trocasContainer = document.getElementById('vpSheetTrocasListContainer');
  if (trocasContainer) {
    if (trocas.length === 0) {
      trocasContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.82rem; padding: 16px;">Nenhuma troca selecionada.</div>';
    } else {
      trocasContainer.innerHTML = trocas.map(p => {
        const formatted = p.obs ? `${p.name} (${p.obs})` : p.name;
        return `
          <div class="vp-sheet-item-row">
            <div>
              <div class="vp-sheet-item-text">🔁 ${vpEscapeHtml(formatted)}</div>
            </div>
            <button type="button" class="vp-btn-sheet-remove" onclick="vpRemoveSelected('${vpEscapeHtml(p.name)}')">✕</button>
          </div>
        `;
      }).join('');
    }
  }

  const reparosContainer = document.getElementById('vpSheetReparosListContainer');
  if (reparosContainer) {
    if (reparos.length === 0) {
      reparosContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.82rem; padding: 16px;">Nenhum reparo selecionado.</div>';
    } else {
      reparosContainer.innerHTML = reparos.map(p => {
        const formatted = p.obs ? `${p.name} (${p.obs})` : p.name;
        return `
          <div class="vp-sheet-item-row">
            <div>
              <div class="vp-sheet-item-text">🛠️ ${vpEscapeHtml(formatted)}</div>
            </div>
            <button type="button" class="vp-btn-sheet-remove" onclick="vpRemoveSelected('${vpEscapeHtml(p.name)}')">✕</button>
          </div>
        `;
      }).join('');
    }
  }
}

window.vpOpenReviewSheet = function() {
  const modal = document.getElementById('vpReviewSheetModal');
  if (modal) modal.style.display = 'flex';
};

window.vpCloseReviewSheet = function() {
  const modal = document.getElementById('vpReviewSheetModal');
  if (modal) modal.style.display = 'none';
};

window.vpHandleReviewOverlayClick = function(e) {
  if (e.target.id === 'vpReviewSheetModal') {
    window.vpCloseReviewSheet();
  }
};

window.vpSwitchSheetTab = function(tab) {
  const btnTrocas = document.getElementById('vpSheetTabTrocas');
  const btnReparos = document.getElementById('vpSheetTabReparos');
  const panelTrocas = document.getElementById('vpSheetTrocasListContainer');
  const panelReparos = document.getElementById('vpSheetReparosListContainer');

  if (tab === 'trocas') {
    if (btnTrocas) {
      btnTrocas.style.background = '#2563eb';
      btnTrocas.style.borderColor = '#2563eb';
      btnTrocas.style.color = '#ffffff';
    }
    if (btnReparos) {
      btnReparos.style.background = '#ffffff';
      btnReparos.style.borderColor = '#cbd5e1';
      btnReparos.style.color = '#64748b';
    }
    if (panelTrocas) panelTrocas.style.display = 'block';
    if (panelReparos) panelReparos.style.display = 'none';
  } else {
    if (btnTrocas) {
      btnTrocas.style.background = '#ffffff';
      btnTrocas.style.borderColor = '#cbd5e1';
      btnTrocas.style.color = '#64748b';
    }
    if (btnReparos) {
      btnReparos.style.background = '#0284c7';
      btnReparos.style.borderColor = '#0284c7';
      btnReparos.style.color = '#ffffff';
    }
    if (panelTrocas) panelTrocas.style.display = 'none';
    if (panelReparos) panelReparos.style.display = 'block';
  }
};

function vpSetupSearch() {
  const input = document.getElementById('vpSearchInput');
  const clearBtn = document.getElementById('vpClearSearchBtn');
  if (!input) return;

  input.value = '';
  if (clearBtn) clearBtn.style.display = 'none';

  input.oninput = (e) => {
    const val = e.target.value;
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    vpRenderParts(val);
  };
}

window.vpClearSearch = function() {
  const input = document.getElementById('vpSearchInput');
  const clearBtn = document.getElementById('vpClearSearchBtn');
  if (input) input.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  vpRenderParts('');
};

window.vpOpenEditPartModal = function(rawName, currentDisplayName, currentZoneId) {
  const modal = document.getElementById('vpEditPartModal');
  const origInput = document.getElementById('vpEditOriginalName');
  const nameInput = document.getElementById('vpEditNameInput');
  const zoneSelect = document.getElementById('vpEditZoneSelect');

  const effectiveZoneId = vpGetPartEffectiveZoneId(rawName, currentZoneId || vpActiveZoneId);

  if (zoneSelect) {
    zoneSelect.innerHTML = vpActiveZones.map(z => `
      <option value="${z.id}" ${z.id === effectiveZoneId ? 'selected' : ''}>${z.icon} ${z.name}</option>
    `).join('');
  }

  if (origInput) origInput.value = rawName;
  if (nameInput) nameInput.value = currentDisplayName;
  if (modal) modal.style.display = 'flex';
  if (nameInput) setTimeout(() => nameInput.focus(), 100);
};

window.vpCloseEditPartModal = function() {
  const modal = document.getElementById('vpEditPartModal');
  if (modal) modal.style.display = 'none';
};

window.vpDeletePart = function(rawName, displayName) {
  const name = displayName || vpGetEffectivePartName(rawName);
  if (!confirm(`Deseja realmente excluir permanentemente a peça "${name}" do catálogo?`)) {
    return;
  }

  // Remove da lista de customizadas se estiver lá
  vpCustomPartsList = vpCustomPartsList.filter(p => 
    p.name.toLowerCase() !== rawName.toLowerCase() && 
    p.name.toLowerCase() !== name.toLowerCase()
  );

  // Adiciona à lista de deletadas
  if (!vpDeletedPartsList.some(d => d.toLowerCase() === rawName.toLowerCase())) {
    vpDeletedPartsList.push(rawName);
  }
  if (name !== rawName && !vpDeletedPartsList.some(d => d.toLowerCase() === name.toLowerCase())) {
    vpDeletedPartsList.push(name);
  }

  // Se estiver selecionada para a vistoria atual, desmarca
  if (vpSelectedPartsMap.has(name)) {
    vpSelectedPartsMap.delete(name);
  }
  if (vpSelectedPartsMap.has(rawName)) {
    vpSelectedPartsMap.delete(rawName);
  }

  vpSaveState(true);
  window.vpCloseEditPartModal();
  vpUpdateTriggerButton();
  vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
  vpUpdateDockAndSheet();
};

window.vpDeleteFromEditModal = function() {
  const origInput = document.getElementById('vpEditOriginalName');
  const nameInput = document.getElementById('vpEditNameInput');
  const rawName = origInput ? origInput.value.trim() : '';
  const displayName = nameInput ? nameInput.value.trim() : rawName;
  if (rawName || displayName) {
    window.vpDeletePart(rawName, displayName);
  }
};

window.vpSaveEditPartName = function(e) {
  e.preventDefault();
  const origInput = document.getElementById('vpEditOriginalName');
  const nameInput = document.getElementById('vpEditNameInput');
  const zoneSelect = document.getElementById('vpEditZoneSelect');

  const rawName = origInput ? origInput.value.trim() : '';
  const newName = nameInput ? nameInput.value.trim() : '';
  const targetZoneId = zoneSelect ? zoneSelect.value : '';

  if (!rawName || !newName) return;

  const oldEffectiveName = vpGetEffectivePartName(rawName);
  vpCustomPartRenamesMap[rawName] = newName;
  if (oldEffectiveName !== newName) {
    vpCustomPartRenamesMap[oldEffectiveName] = newName;
  }

  // Atualiza override de zona
  if (targetZoneId) {
    vpPartZoneOverridesMap[rawName] = targetZoneId;
    vpPartZoneOverridesMap[newName] = targetZoneId;
    vpPartZoneOverridesMap[oldEffectiveName] = targetZoneId;

    // Se estiver em vpCustomPartsList, atualiza a zona diretamente
    const customItem = vpCustomPartsList.find(p => p.name.toLowerCase() === rawName.toLowerCase() || p.name.toLowerCase() === oldEffectiveName.toLowerCase());
    if (customItem) {
      customItem.name = newName;
      customItem.zoneId = targetZoneId;
    }
  }

  if (vpSelectedPartsMap.has(oldEffectiveName)) {
    const prevItem = vpSelectedPartsMap.get(oldEffectiveName);
    vpSelectedPartsMap.delete(oldEffectiveName);
    prevItem.name = newName;
    if (targetZoneId) {
      prevItem.zoneId = targetZoneId;
      const targetZoneObj = vpActiveZones.find(z => z.id === targetZoneId);
      if (targetZoneObj) prevItem.zoneName = targetZoneObj.name;
    }
    vpSelectedPartsMap.set(newName, prevItem);
  } else if (targetZoneId && vpSelectedPartsMap.has(newName)) {
    const prevItem = vpSelectedPartsMap.get(newName);
    prevItem.zoneId = targetZoneId;
    const targetZoneObj = vpActiveZones.find(z => z.id === targetZoneId);
    if (targetZoneObj) prevItem.zoneName = targetZoneObj.name;
  }

  vpSaveState(true);
  window.vpCloseEditPartModal();
  vpRenderParts(document.getElementById('vpSearchInput')?.value || '');
  vpUpdateDockAndSheet();
};

window.vpOpenAddCustomModal = function() {
  const select = document.getElementById('vpCustomZoneSelect');
  if (select) {
    select.innerHTML = vpActiveZones.map(z => `
      <option value="${z.id}" ${z.id === vpActiveZoneId ? 'selected' : ''}>${z.icon} ${z.name}</option>
    `).join('');
  }
  const nameInput = document.getElementById('vpCustomNameInput');
  const obsInput = document.getElementById('vpCustomObsInput');
  if (nameInput) nameInput.value = '';
  if (obsInput) obsInput.value = '';
  const modal = document.getElementById('vpAddCustomModal');
  if (modal) modal.style.display = 'flex';
  if (nameInput) setTimeout(() => nameInput.focus(), 100);
};

window.vpCloseAddCustomModal = function() {
  const modal = document.getElementById('vpAddCustomModal');
  if (modal) modal.style.display = 'none';
};

window.vpSaveCustomPart = function(e) {
  e.preventDefault();
  const zoneSelect = document.getElementById('vpCustomZoneSelect');
  const nameInput = document.getElementById('vpCustomNameInput');
  const obsInput = document.getElementById('vpCustomObsInput');
  const actionRadio = document.querySelector('input[name="vpCustomAction"]:checked');

  const zoneId = zoneSelect ? zoneSelect.value : vpActiveZoneId;
  const name = nameInput ? nameInput.value.trim() : '';
  const obs = obsInput ? obsInput.value.trim() : '';
  const action = actionRadio ? actionRadio.value : 'troca'; // 'troca' | 'reparo' | 'catalogo'

  if (!name) return;

  const zObj = vpActiveZones.find(z => z.id === zoneId);
  const zoneName = zObj ? zObj.name : 'Personalizada';

  // Se havia sido excluída anteriormente, remove da lista de excluídas
  vpDeletedPartsList = vpDeletedPartsList.filter(d => d.toLowerCase() !== name.toLowerCase());

  // Salva permanentemente no catálogo customizado com o tipo de veículo atual
  const existingIdx = vpCustomPartsList.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  if (existingIdx >= 0) {
    vpCustomPartsList[existingIdx].zoneId = zoneId;
    vpCustomPartsList[existingIdx].vehicleType = vpDetectedVehicleType;
  } else {
    vpCustomPartsList.push({ name, zoneId, vehicleType: vpDetectedVehicleType });
  }

  // Se a ação for troca ou reparo, adiciona também à seleção da vistoria atual
  if (action === 'troca' || action === 'reparo') {
    vpSelectedPartsMap.set(name, {
      name: name,
      rawName: name,
      zoneId: zoneId,
      zoneName: zoneName,
      action: action,
      obs: obs
    });
  }

  vpSaveState(true);
  window.vpCloseAddCustomModal();
  vpActiveZoneId = zoneId;
  vpViewAllZonesMode = false;
  vpUpdateTriggerButton();
  vpRenderParts();
  vpUpdateDockAndSheet();
};

function vpEscapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Sincronização em tempo real da digitação da placa / modelo com o detector de veículo
if (typeof plateInput !== 'undefined' && plateInput) {
  plateInput.addEventListener('input', () => {
    const text = plateInput.value.trim();
    if (!text) return;
    const type = vpDetectVehicleTypeFromText(text);

    // 1. Atualiza rótulo do botão de partes
    const btnSpan = document.querySelector('.btn-open-parts-selector span');
    if (btnSpan) {
      if (type === 'moto') {
        btnSpan.textContent = '🏍️ Selecionar Partes da Moto (Zonas)';
      } else if (type === 'caminhao') {
        btnSpan.textContent = '🚛 Selecionar Partes do Caminhão (Zonas)';
      } else if (type === 'picape') {
        btnSpan.textContent = '🛻 Selecionar Partes da Picape (Zonas)';
      } else {
        btnSpan.textContent = '🚗 Selecionar Partes do Veículo (Zonas)';
      }
    }

    // 2. Sincroniza aba principal do formulário (Moto vs Inicial)
    if (typeof vistoriaTypeTabs !== 'undefined' && vistoriaTypeTabs) {
      const isCurrentlyMoto = typeof selectedType !== 'undefined' && selectedType === 'Moto';
      if (type === 'moto' && !isCurrentlyMoto && (selectedType === 'Inicial' || !selectedType)) {
        selectedType = 'Moto';
        vistoriaTypeTabs.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.type === 'Moto');
        });
        if (typeof typeInput !== 'undefined' && typeInput) typeInput.value = 'Moto';
        if (typeof updateVistoriaFormTitle === 'function') updateVistoriaFormTitle();
        if (typeof renderDynamicSurveyFields === 'function') renderDynamicSurveyFields();
      } else if (type !== 'moto' && isCurrentlyMoto) {
        selectedType = 'Inicial';
        vistoriaTypeTabs.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.type === 'Inicial');
        });
        if (typeof typeInput !== 'undefined' && typeInput) typeInput.value = 'Inicial';
        if (typeof updateVistoriaFormTitle === 'function') updateVistoriaFormTitle();
        if (typeof renderDynamicSurveyFields === 'function') renderDynamicSurveyFields();
      }
    }
  });
}

