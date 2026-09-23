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
  { name: 'Para barro Diant. LD', zoneId: 'dianteira', vehicleType: 'all' },
  { name: 'Para barro Diant. LE', zoneId: 'dianteira', vehicleType: 'all' },
  { name: 'Protetor de cárter / peito de aço', zoneId: 'dianteira', vehicleType: 'all' },
  { name: 'Suporte do radiador', zoneId: 'dianteira', vehicleType: 'all' },
  { name: 'Defletor do radiador', zoneId: 'dianteira', vehicleType: 'all' },
  { name: 'Trava / fecho do capô', zoneId: 'dianteira', vehicleType: 'all' },
  { name: 'Buzina Diant.', zoneId: 'dianteira', vehicleType: 'all' },
  { name: 'Sensor de estacionamento Tras.', zoneId: 'traseira', vehicleType: 'all' },
  { name: 'Câmera de ré', zoneId: 'traseira', vehicleType: 'all' },
  { name: 'Luz de placa Tras. LD', zoneId: 'traseira', vehicleType: 'all' },
  { name: 'Luz de placa Tras. LE', zoneId: 'traseira', vehicleType: 'all' },
  { name: 'Fechadura da tampa do porta malas', zoneId: 'traseira', vehicleType: 'all' },
  { name: 'Amortecedor da tampa Tras. LD', zoneId: 'traseira', vehicleType: 'all' },
  { name: 'Amortecedor da tampa Tras. LE', zoneId: 'traseira', vehicleType: 'all' },
  { name: 'Fechadura da porta Diant. LD', zoneId: 'lateral_dir', vehicleType: 'all' },
  { name: 'Fechadura da porta Diant. LE', zoneId: 'lateral_esq', vehicleType: 'all' },
  { name: 'Fechadura da porta Tras. LD', zoneId: 'lateral_dir', vehicleType: 'all' },
  { name: 'Fechadura da porta Tras. LE', zoneId: 'lateral_esq', vehicleType: 'all' },
  { name: 'Coxim do amortecedor Diant. LD', zoneId: 'mecanica_susp', vehicleType: 'all' },
  { name: 'Coxim do amortecedor Diant. LE', zoneId: 'mecanica_susp', vehicleType: 'all' },
  { name: 'Bieleta da barra estabilizadora LD', zoneId: 'mecanica_susp', vehicleType: 'all' },
  { name: 'Bieleta da barra estabilizadora LE', zoneId: 'mecanica_susp', vehicleType: 'all' },
  { name: 'Terminal de direção LD', zoneId: 'mecanica_susp', vehicleType: 'all' },
  { name: 'Terminal de direção LE', zoneId: 'mecanica_susp', vehicleType: 'all' },
  { name: 'Barra axial de direção LD', zoneId: 'mecanica_susp', vehicleType: 'all' },
  { name: 'Barra axial de direção LE', zoneId: 'mecanica_susp', vehicleType: 'all' }
];

let cachedCatalogData = {
  customParts: [...DEFAULT_PRELOADED_PARTS],
  deletedParts: [],
  renames: {},
  zoneOverrides: {},
  usageStats: {},
  updatedAt: Date.now()
};

// Tenta restaurar do arquivo se existir
try {
  if (fs.existsSync(BACKUP_FILE)) {
    const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.customParts) && parsed.customParts.length > 0) {
      cachedCatalogData = parsed;
    }
  }
} catch(e) {}

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
      cachedCatalogData.customParts.forEach(p => { if (p && p.name) p.name = cleanPartDashes(p.name); });
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
          data.customParts.forEach(p => { if (p && p.name) { p.name = cleanPartDashes(p.name); map.set(p.name.toLowerCase(), p); } });
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
        if (data.usageStats && typeof data.usageStats === 'object') {
          cachedCatalogData.usageStats = Object.assign({}, cachedCatalogData.usageStats, data.usageStats);
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
