// pages/api/facilitator/config.ts
import type { NextApiRequest, NextApiResponse } from 'next';

interface FacilitatorConfigResponse {
  success: boolean;
  config?: {
    apiKeyId: string;
    apiKeySecret: string;
  };
  error?: string;
  environmentStatus?: {
    hasCdpApiKey: boolean;
    hasCdpApiSecret: boolean;
    hasSellerAddress: boolean;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FacilitatorConfigResponse>
) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  console.log(`🚀 [${requestId}] /api/facilitator/config called:`, {
    method: req.method,
    userAgent: req.headers['user-agent']?.substring(0, 50),
    contentType: req.headers['content-type']
  });

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { userAddress } = req.body;

    console.log(`👤 [${requestId}] Request details:`, {
      userAddress,
      bodyKeys: Object.keys(req.body),
      hasUserAddress: !!userAddress
    });

    if (!userAddress) {
      console.log(`❌ [${requestId}] User address is required`);
      return res.status(400).json({
        success: false,
        error: 'User address is required'
      });
    }

    // Check environment variables directly
    const hasCdpApiKey = !!process.env.CDP_API_KEY_ID;
    const hasCdpApiSecret = !!process.env.CDP_API_KEY_SECRET;
    const hasSellerAddress = !!process.env.NEXT_PUBLIC_X402_SELLER_ADDRESS;

    console.log(`🔧 [${requestId}] Environment status:`, {
      hasCdpApiKey,
      hasCdpApiSecret,
      hasSellerAddress,
      cdpApiKeyPreview: process.env.CDP_API_KEY_ID ? '***' + process.env.CDP_API_KEY_ID.slice(-4) : 'none'
    });

    if (!hasCdpApiKey || !hasCdpApiSecret) {
      console.log(`❌ [${requestId}] CDP API keys not configured`);
      return res.status(404).json({
        success: false,
        error: 'CDP facilitator configuration not available. Check CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables.',
        environmentStatus: {
          hasCdpApiKey,
          hasCdpApiSecret,
          hasSellerAddress
        }
      });
    }

    console.log(`✅ [${requestId}] Returning facilitator config`);
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ [${requestId}] Request processed in ${processingTime}ms`);

    // Return the facilitator configuration
    res.status(200).json({
      success: true,
      config: {
        apiKeyId: process.env.CDP_API_KEY_ID!,
        apiKeySecret: process.env.CDP_API_KEY_SECRET!
      },
      environmentStatus: {
        hasCdpApiKey,
        hasCdpApiSecret,
        hasSellerAddress
      }
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`💥 [${requestId}] Facilitator config error:`, {
      error: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`
    });
    
    res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
}