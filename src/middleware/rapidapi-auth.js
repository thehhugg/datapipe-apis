/**
 * RapidAPI Proxy Authentication Middleware
 * 
 * When deployed behind RapidAPI's proxy, all requests include:
 * - X-RapidAPI-Proxy-Secret: shared secret to verify the request is from RapidAPI
 * - X-RapidAPI-User: subscriber's username
 * - X-RapidAPI-Subscription: subscription tier (BASIC, PRO, ULTRA, MEGA, CUSTOM)
 * 
 * In development (no RAPIDAPI_PROXY_SECRET set), all requests pass through.
 */

export function rapidApiAuth(req, res, next) {
  const secret = process.env.RAPIDAPI_PROXY_SECRET;
  
  // Dev mode: no secret configured, allow all
  if (!secret) {
    req.rapidapi = { user: 'dev', subscription: 'ULTRA', authenticated: false };
    return next();
  }
  
  const proxySecret = req.headers['x-rapidapi-proxy-secret'];
  
  if (proxySecret !== secret) {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'This API is only accessible through RapidAPI. Visit https://rapidapi.com/datapipe to subscribe.'
    });
  }
  
  req.rapidapi = {
    user: req.headers['x-rapidapi-user'] || 'unknown',
    subscription: req.headers['x-rapidapi-subscription'] || 'BASIC',
    authenticated: true
  };
  
  next();
}

/**
 * Request logger middleware — logs all API calls for analytics
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      user: req.rapidapi?.user || 'unknown',
      subscription: req.rapidapi?.subscription || 'none',
      ip: req.ip,
      query: Object.keys(req.query).length ? req.query : undefined
    };
    
    // Only log API calls, not health checks
    if (req.path.startsWith('/api/')) {
      console.log(JSON.stringify(log));
    }
  });
  
  next();
}
