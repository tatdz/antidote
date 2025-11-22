// lib/facilitator-loader.ts
'use client';

import { createCDPAuthHeaders } from './cdp-jwt-generator';

export interface FacilitatorConfig {
  url: string;
  createAuthHeaders: () => Promise<{
    verify: Record<string, string>;
    settle: Record<string, string>;
    supported: Record<string, string>;
    list: Record<string, string>;
  }>;
}

export async function loadFacilitatorConfig(userAddress: string): Promise<FacilitatorConfig | null> {
  const startTime = Date.now();
  console.log('🔑 Loading CDP facilitator config for x402 payments:', userAddress);

  try {
    const response = await fetch('/api/facilitator/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userAddress }),
    });

    console.log('🔑 Facilitator API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.warn('⚠️ Could not load facilitator config:', {
        status: response.status,
        error: errorData.error
      });
      return null;
    }

    const { config } = await response.json();
    
    console.log('🔑 Facilitator config received:', {
      hasConfig: !!config,
      apiKeyId: config?.apiKeyId ? `${config.apiKeyId.substring(0, 10)}...` : 'none',
      apiKeySecret: config?.apiKeySecret ? '***' : 'none',
      loadTime: `${Date.now() - startTime}ms`
    });

    if (!config) {
      console.warn('⚠️ No facilitator config returned from server');
      return null;
    }

    // Create facilitator config with proper JWT generation
    const facilitatorConfig: FacilitatorConfig = {
      url: 'https://api.cdp.coinbase.com',
      createAuthHeaders: async () => {
        console.log('🔐 Creating CDP auth headers with proper JWT...');
        
        try {
          // Create auth headers for different CDP endpoints
          const baseHeaders = await createCDPAuthHeaders(
            'GET',
            'api.cdp.coinbase.com',
            '/platform/v2/x402',
            config.apiKeyId,
            config.apiKeySecret
          );

          console.log('✅ CDP JWT auth headers generated successfully:', {
            hasAuthHeader: !!baseHeaders.Authorization,
            authHeaderLength: baseHeaders.Authorization?.length,
            hasApiKey: !!baseHeaders['X-CDP-API-KEY']
          });

          return {
            verify: baseHeaders,
            settle: baseHeaders,
            supported: baseHeaders,
            list: baseHeaders
          };

        } catch (error: any) {
          console.error('💥 CDP JWT generation failed:', error);
          throw new Error(`CDP authentication failed: ${error.message}`);
        }
      }
    };

    console.log('🎉 CDP facilitator configured with proper JWT support');
    return facilitatorConfig;

  } catch (error: any) {
    console.error('💥 Failed to load facilitator config for x402:', {
      error: error.message,
      stack: error.stack,
      loadTime: `${Date.now() - startTime}ms`
    });
    return null;
  }
}