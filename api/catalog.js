const fs = require('fs');
const path = require('path');

function cleanPartDashes(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

// Arquivo de persistência secundária em disco (para servidor local ou containers que suportam escrita)
const BACKUP_FILE = path.join('/tmp', 'gestao_catalog_cache.json');

// Catálogo base de peças mais comuns cadastradas para vistorias (garante que nunca venha vazio se houver reinício da nuvem)
const DEFAULT_PRELOADED_PARTS = [
  { name: 'Para barro Diant. LD', zoneId: 'dianteira', vehicleType: 'carro' },
  { name: 'Para barro Diant. LE', zoneId: 'dianteira', vehicleType: 'carro' },
  { name: 'Protetor de cárter / peito de aço', zoneId: 'dianteira', vehicleType: 'carro' },
  { name: 'Suporte do radiador', zoneId: 'dianteira', vehicleType: 'carro' },
  { name: 'Defletor do radiador', zoneId: 'dianteira', vehicleType: 'carro' },
  { name: 'Trava / fecho do capô', zoneId: 'dianteira', vehicleType: 'carro' },
  { name: 'Buzina Diant.', zoneId: 'dianteira', vehicleType: 'carro' },
  { name: 'Sensor de estacionamento Tras.', zoneId: 'traseira', vehicleType: 'carro' },
  { name: 'Câmera de ré', zoneId: 'traseira', vehicleType: 'carro' },
  { name: 'Luz de placa Tras. LD', zoneId: 'traseira', vehicleType: 'carro' },
  { name: 'Luz de placa Tras. LE', zoneId: 'traseira', vehicleType: 'carro' },
  { name: 'Fechadura da tampa do porta malas', zoneId: 'traseira', vehicleType: 'carro' },
  { name: 'Amortecedor da tampa Tras. LD', zoneId: 'traseira', vehicleType: 'carro' },
  { name: 'Amortecedor da tampa Tras. LE', zoneId: 'traseira', vehicleType: 'carro' },
  { name: 'Fechadura da porta Diant. LD', zoneId: 'lateral_dir', vehicleType: 'carro' },
  { name: 'Fechadura da porta Diant. LE', zoneId: 'lateral_esq', vehicleType: 'carro' },
  { name: 'Fechadura da porta Tras. LD', zoneId: 'lateral_dir', vehicleType: 'carro' },
  { name: 'Fechadura da porta Tras. LE', zoneId: 'lateral_esq', vehicleType: 'carro' },
  { name: 'Coxim do amortecedor Diant. LD', zoneId: 'mecanica_susp', vehicleType: 'carro' },
  { name: 'Coxim do amortecedor Diant. LE', zoneId: 'mecanica_susp', vehicleType: 'carro' },
  { name: 'Bieleta da barra estabilizadora LD', zoneId: 'mecanica_susp', vehicleType: 'carro' },
  { name: 'Bieleta da barra estabilizadora LE', zoneId: 'mecanica_susp', vehicleType: 'carro' },
  { name: 'Terminal de direção LD', zoneId: 'mecanica_susp', vehicleType: 'carro' },
  { name: 'Terminal de direção LE', zoneId: 'mecanica_susp', vehicleType: 'carro' },
  { name: 'Barra axial de direção LD', zoneId: 'mecanica_susp', vehicleType: 'carro' },
  { name: 'Barra axial de direção LE', zoneId: 'mecanica_susp', vehicleType: 'carro' }
];

function inferPartVehicleType(name) {
  if (!name || typeof name !== 'string') return 'carro';
  const upper = name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const isMoto = /\b(GUIDAO|GUIDÃO|MESA SUPERIOR|MESA INFERIOR|BENGALA|GARFO DIANT|MANETE|MANOPLA|CARENAGEM DO FAROL|BOLHA|RABETA|MONOSHOCK|CAVALETE CENTRAL|CAVALETE LATERAL|DESCANSO LATERAL|ALCA TRAS DO GARUPA|ALÇA TRAS DO GARUPA|ALÇA DO GARUPA|PEDALEIRA|PEDAL DE CAMBIO|PEDAL DE CÂMBIO|CORRENTE DE TRANSMISSAO|RELAÇÃO|RELACAO|TAMPA DO ESTATOR|TAMPA DA EMBREAGEM|PROTETOR DE CARENAGEM)\b/i.test(upper);
  if (isMoto) return 'moto';

  const isPicape = /\b(CACAMBA|CAÇAMBA|PROTETOR DE CACAMBA|PROTETOR DE CAÇAMBA|SANTO ANTONIO|SANTO ANTÔNIO|CAPOTA MARITIMA|CAPOTA MARÍTIMA)\b/i.test(upper);
  if (isPicape) return 'picape';

  const isCaminhao = /\b(CABINE DIANTEIRA|CLIMATIZADOR DE TETO|QUINTA RODA|PORTAS TRAS DO BAU|PORTAS TRAS DO BAÚ|CUICA DE FREIO|CUÍCA DE FREIO|SUSPENSOR PNEUMATICO)\b/i.test(upper);
  if (isCaminhao) return 'caminhao';

  const isCar = /\b(PORTA|CAPO|CAPÔ|PORTA-MALAS|PORTA MALAS|PARA-CHOQUE|PARACHOQUE|PARA-BARRO|PARABARRO|PARA-BRISA|PARABRISA|AIRBAG|BANDEJA|PIVO|PIVÔ|BIELETA|BARRA AXIAL|TERMINAL DE DIRECAO|TERMINAL DE DIREÇÃO|COXIM|PROTETOR DE CARTER|PROTETOR DE CÁRTER|SENSOR DE ESTACIONAMENTO|CAMERA DE RE|CÂMERA DE RÉ|TETO SOLAR|CAIXA DE AR|SOLEIRA)\b/i.test(upper);
  if (isCar) return 'carro';

  return 'carro';
}

let cachedCatalogData = {
  customParts: [...DEFAULT_PRELOADED_PARTS],
  deletedParts: [],
  renames: {},
  zoneOverrides: {},
  vehicleTypeMap: {},
  customOrders: { carro: [], moto: [], picape: [], caminhao: [] },
  configGuard: {},
  usageStats: {},
  customTabs: [],
  updatedAt: Date.now()
};

// Tenta restaurar do arquivo se existir
try {
  if (fs.existsSync(BACKUP_FILE)) {
    const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.customParts) && parsed.customParts.length > 0) {
      cachedCatalogData = Object.assign(cachedCatalogData, parsed);
    }
  }
} catch(e) {}

// Sanitiza peças precarregadas e em cache garantindo que nenhuma peça fique com 'all' indevidamente
if (Array.isArray(cachedCatalogData.customParts)) {
  cachedCatalogData.customParts.forEach(p => {
    if (!p) return;
    if (p.name) p.name = cleanPartDashes(p.name);
    if (!p.vehicleType || p.vehicleType === 'all') {
      p.vehicleType = inferPartVehicleType(p.name);
    }
  });
}

module.exports = async (req, res) => {
  // Configura CORS total para acesso tanto do PWA quanto do app Android
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    if (Array.isArray(cachedCatalogData.customParts)) {
      cachedCatalogData.customParts.forEach(p => {
        if (!p) return;
        if (p.name) p.name = cleanPartDashes(p.name);
        if (!p.vehicleType || p.vehicleType === 'all') {
          p.vehicleType = inferPartVehicleType(p.name);
        }
      });
    }
    return res.status(200).json({
      success: true,
      data: cachedCatalogData
    });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      const data = (body && body.data) ? body.data : body;

      if (data && typeof data === 'object') {
        if (Array.isArray(data.customParts)) {
          // Merge seguro: nunca zera se já tivermos dados salvos
          const map = new Map();
          cachedCatalogData.customParts.forEach(p => { if (p && p.name) map.set(p.name.toLowerCase(), p); });
          data.customParts.forEach(p => {
            if (p && p.name) {
              p.name = cleanPartDashes(p.name);
              if (!p.vehicleType || p.vehicleType === 'all') {
                p.vehicleType = inferPartVehicleType(p.name);
              }
              map.set(p.name.toLowerCase(), p);
            }
          });
          cachedCatalogData.customParts = Array.from(map.values());
        }
        if (Array.isArray(data.deletedParts)) {
          // Apenas mantém exclusões enviadas pelo cliente que NÃO estão no catálogo de peças ativas
          const activeCustomNames = new Set(cachedCatalogData.customParts.map(p => (p.name || '').toLowerCase()));
          cachedCatalogData.deletedParts = data.deletedParts.filter(d => d && !activeCustomNames.has(d.toLowerCase()));
        }
        if (data.renames && typeof data.renames === 'object') {
          cachedCatalogData.renames = Object.assign({}, cachedCatalogData.renames, data.renames);
        }
        if (data.zoneOverrides && typeof data.zoneOverrides === 'object') {
          cachedCatalogData.zoneOverrides = Object.assign({}, cachedCatalogData.zoneOverrides, data.zoneOverrides);
        }
        if (data.vehicleTypeMap && typeof data.vehicleTypeMap === 'object') {
          cachedCatalogData.vehicleTypeMap = Object.assign({}, cachedCatalogData.vehicleTypeMap, data.vehicleTypeMap);
        }
        if (data.customOrders && typeof data.customOrders === 'object') {
          cachedCatalogData.customOrders = Object.assign({}, cachedCatalogData.customOrders, data.customOrders);
        }
        if (data.configGuard && typeof data.configGuard === 'object') {
          cachedCatalogData.configGuard = Object.assign({}, cachedCatalogData.configGuard, data.configGuard);
        }
        if (data.usageStats && typeof data.usageStats === 'object') {
          cachedCatalogData.usageStats = Object.assign({}, cachedCatalogData.usageStats, data.usageStats);
        }
        if (Array.isArray(data.customTabs)) {
          const tabMap = new Map();
          (cachedCatalogData.customTabs || []).forEach(t => { if (t && t.id) tabMap.set(t.id, t); });
          data.customTabs.forEach(t => { if (t && t.id) tabMap.set(t.id, t); });
          cachedCatalogData.customTabs = Array.from(tabMap.values());
        }

        // Garante sanitização final: nenhuma peça ativa pode estar em deletedParts
        if (cachedCatalogData.deletedParts && cachedCatalogData.deletedParts.length > 0) {
          const activeMap = new Set(cachedCatalogData.customParts.map(p => (p.name || '').toLowerCase()));
          cachedCatalogData.deletedParts = cachedCatalogData.deletedParts.filter(d => d && !activeMap.has(d.toLowerCase()));
        }

        cachedCatalogData.updatedAt = Date.now();

        // Tenta salvar em disco para preservar entre reloads locais
        try {
          fs.writeFileSync(BACKUP_FILE, JSON.stringify(cachedCatalogData), 'utf8');
        } catch(e) {}
      }

      return res.status(200).json({
        success: true,
        data: cachedCatalogData
      });
    } catch (err) {
      return res.status(200).json({
        success: true,
        data: cachedCatalogData,
        warning: err.message
      });
    }
  }

  return res.status(200).json({
    success: true,
    data: cachedCatalogData
  });
};
