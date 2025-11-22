// pages/api/test-cdp.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userAddress } = req.body;
    
    console.log('🧪 Testing CDP Facilitator for:', userAddress);
    
    // Test facilitator config loading
    const response = await fetch('/api/facilitator/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userAddress }),
    });

    const result = await response.json();
    
    console.log('🧪 CDP Test Results:', {
      status: response.status,
      hasConfig: !!result.config,
      configKeys: result.config ? Object.keys(result.config) : [],
      apiKeyId: result.config?.apiKeyId ? '***' + result.config.apiKeyId.slice(-4) : 'none'
    });

    res.status(200).json({
      success: true,
      cdpAvailable: !!result.config,
      config: result.config ? {
        hasApiKey: !!result.config.apiKeyId,
        hasApiSecret: !!result.config.apiKeySecret,
        keyPreview: result.config.apiKeyId ? '***' + result.config.apiKeyId.slice(-4) : 'none'
      } : null
    });

  } catch (error: any) {
    console.error('🧪 CDP Test Failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}