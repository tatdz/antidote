// lib/env.ts
// This version works with both Node.js and Edge runtimes

// For server-side (Node.js) we can use dotenv, for client-side we rely on Next.js env loading
let envVarsLoaded = false;

// Only try to load dotenv on server-side in Node.js runtime
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    // Dynamic import for dotenv to avoid Edge runtime issues
    const { config } = require('dotenv');
    config({ path: '.env.local' });
    envVarsLoaded = true;
    console.log('🔧 dotenv loaded .env.local file');
  } catch (error) {
    console.log('🔧 dotenv not available, relying on Next.js environment loading');
  }
}

export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  
  if (!value && !defaultValue) {
    console.warn(`⚠️ Environment variable ${key} is not set`);
  } else if (!value && defaultValue) {
    console.log(`🔧 Using default value for ${key}: ${defaultValue}`);
  } else {
    console.log(`✅ Environment variable ${key} is set`);
  }
  
  return value || '';
}

export const env = {
  // CDP Configuration
  CDP_API_KEY_ID: getEnvVar('CDP_API_KEY_ID'),
  CDP_API_KEY_SECRET: getEnvVar('CDP_API_KEY_SECRET'),
  
  // Payment Configuration
  X402_SELLER_ADDRESS: getEnvVar('NEXT_PUBLIC_X402_SELLER_ADDRESS'),
  PLATFORM_CHAIN_ID: parseInt(getEnvVar('NEXT_PUBLIC_PLATFORM_CHAIN_ID', '11155111')),
  PAYMENT_CHAIN_ID: parseInt(getEnvVar('NEXT_PUBLIC_PAYMENT_CHAIN_ID', '84532')),
};

// Log environment status (safe for all runtimes)
console.log('🔧 Environment status:', {
  envVarsLoaded,
  hasCdpConfig: !!(env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET),
  hasSellerAddress: !!env.X402_SELLER_ADDRESS,
  platformChainId: env.PLATFORM_CHAIN_ID,
  paymentChainId: env.PAYMENT_CHAIN_ID
});

if (!env.X402_SELLER_ADDRESS) {
  console.error('❌ CRITICAL: NEXT_PUBLIC_X402_SELLER_ADDRESS is required');
  // Don't throw in client-side or it will break the app
  if (typeof window === 'undefined') {
    throw new Error('NEXT_PUBLIC_X402_SELLER_ADDRESS environment variable is required');
  }
}