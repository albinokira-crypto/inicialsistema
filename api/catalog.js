let cachedCatalogData = {
  customParts: [],
  deletedParts: [],
  renames: {},
  zoneOverrides: {},
  usageStats: {},
  updatedAt: Date.now()
};

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
        if (Array.isArray(data.customParts)) cachedCatalogData.customParts = data.customParts;
        if (Array.isArray(data.deletedParts)) cachedCatalogData.deletedParts = data.deletedParts;
        if (data.renames && typeof data.renames === 'object') cachedCatalogData.renames = data.renames;
        if (data.zoneOverrides && typeof data.zoneOverrides === 'object') cachedCatalogData.zoneOverrides = data.zoneOverrides;
        if (data.usageStats && typeof data.usageStats === 'object') cachedCatalogData.usageStats = data.usageStats;
        cachedCatalogData.updatedAt = Date.now();
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
