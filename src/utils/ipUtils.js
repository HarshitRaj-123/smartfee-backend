/**
 * Get the real IP address from request
 * Handles various proxy headers and forwarded IPs
 */
const getClientIP = (req) => {
  return (
    req.headers['cf-connecting-ip'] || // Cloudflare
    req.headers['x-real-ip'] || // Nginx proxy
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || // Load balancer/proxy
    req.headers['x-client-ip'] || // Apache
    req.headers['x-cluster-client-ip'] || // Cluster
    req.headers['x-forwarded'] ||
    req.headers['forwarded-for'] ||
    req.headers['forwarded'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
    req.ip ||
    '0.0.0.0'
  );
};

/**
 * Parse user agent to extract device info
 */
const parseUserAgent = (userAgent) => {
  const ua = userAgent || '';
  
  // Simple browser detection
  let browser = 'Unknown';
  if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Edge/')) browser = 'Edge';
  else if (ua.includes('Opera/')) browser = 'Opera';

  // Simple OS detection
  let os = 'Unknown';
  if (ua.includes('Windows NT')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Simple device detection
  let device = 'Desktop';
  if (ua.includes('Mobile')) device = 'Mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';

  return { browser, os, device };
};

module.exports = {
  getClientIP,
  parseUserAgent
}; 