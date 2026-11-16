// True when a request's Origin names the same host the browser sent the request to (the site's own pages).
// Browsers always set Host to the server actually contacted, so another site's page can never pass this check.
export function isOwnOrigin(origin: string, host: string | undefined) {
  if (!host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.host.toLowerCase() === host.trim().toLowerCase();
  } catch {
    return false;
  }
}
