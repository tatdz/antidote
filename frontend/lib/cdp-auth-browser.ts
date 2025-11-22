// lib/cdp-auth-browser.ts (for browser fallback)
export async function createCDPAuthHeadersBrowser(
  method: string,
  host: string,
  path: string,
  apiKeyName: string,
  privateKey: string
): Promise<Record<string, string>> {
  console.warn('⚠️ Using browser fallback for CDP auth - JWT signing not available');
  
  // Fallback: create simple auth without JWT signing
  return {
    'Authorization': `Basic ${btoa(`${apiKeyName}:${privateKey}`)}`,
    'X-CDP-API-KEY': apiKeyName,
    'X-CDP-Auth-Mode': 'fallback'
  };
}