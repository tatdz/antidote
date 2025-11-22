// pages/api/debug-facilitator.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '../../lib/env';

// Import env loader
import '../../lib/env';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userAddress } = req.body;
    
    console.log('🔍 DEBUG: Environment Status:', {
      CDP_API_KEY_ID: env.CDP_API_KEY_ID ? '***' + env.CDP_API_KEY_ID.slice(-4) : 'MISSING',
      CDP_API_KEY_SECRET: env.CDP_API_KEY_SECRET ? '***' : 'MISSING',
      X402_SELLER_ADDRESS: env.X402_SELLER_ADDRESS || 'MISSING'
    });

    // Use the correct path to your existing facilitator loader
    const { loadFacilitatorConfig } = await import('../../lib/facilitator-loader');
    
    const config = await loadFacilitatorConfig(userAddress);
    
    console.log('🔍 DEBUG: Facilitator config result:', {
      hasConfig: !!config,
      configType: typeof config
    });

    res.status(200).json({
      success: true,
      environment: {
        hasCdpApiKey: !!env.CDP_API_KEY_ID,
        hasCdpApiSecret: !!env.CDP_API_KEY_SECRET,
        hasSellerAddress: !!env.X402_SELLER_ADDRESS
      },
      hasConfig: !!config,
      config: config ? {
        hasUrl: !!config.url,
        url: config.url,
        hasCreateAuthHeaders: !!config.createAuthHeaders
      } : null
    });

  } catch (error: any) {
    console.error('💥 DEBUG: Facilitator debug failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}