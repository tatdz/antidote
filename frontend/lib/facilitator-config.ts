// lib/facilitator-config.ts
import { env } from './env';

export async function getFacilitatorConfig(userAddress: string) {
  console.log('🔧 getFacilitatorConfig called for:', userAddress);
  console.log('🔧 CDP Environment Status:', {
    hasApiKeyId: !!env.CDP_API_KEY_ID,
    hasApiKeySecret: !!env.CDP_API_KEY_SECRET,
    apiKeyIdPreview: env.CDP_API_KEY_ID ? '***' + env.CDP_API_KEY_ID.slice(-4) : 'none'
  });

  if (!env.CDP_API_KEY_ID || !env.CDP_API_KEY_SECRET) {
    console.warn('⚠️ CDP API keys not found in environment variables');
    console.warn('⚠️ Payment will work without CDP compliance features');
    return null;
  }

  return {
    apiKeyId: env.CDP_API_KEY_ID,
    apiKeySecret: env.CDP_API_KEY_SECRET
  };
}