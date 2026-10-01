function createCorsMiddleware(configuredOrigins = '') {
  const allowedOrigins = new Set(
    String(configuredOrigins)
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin && origin !== '*')
  );

  return (req, res, next) => {
    const origin = req.headers.origin;
    const isAllowed = Boolean(origin && allowedOrigins.has(origin));

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      if (origin && !isAllowed) return res.sendStatus(403);
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      return res.sendStatus(204);
    }

    return next();
  };
}

module.exports = { createCorsMiddleware };