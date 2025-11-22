// pages/api/ipfs/upload.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }

    console.log('📦 Starting IPFS upload...');
    const pinataJWT = process.env.PINATA_JWT;

    if (!pinataJWT) {
      throw new Error('PINATA_JWT environment variable is required');
    }

    console.log('🔑 Using JWT authentication');
    console.log('📊 Data to upload:', typeof data, 'keys:', Object.keys(data).slice(0, 5));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      // FIX: Send the data directly as pinataContent, don't nest it
      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pinataJWT}`
        },
        body: JSON.stringify({
          pinataContent: data, // Direct data, no nesting
          pinataMetadata: {
            name: `claim-proof-${Date.now()}.json`,
            keyvalues: {
              type: 'zk-proof',
              timestamp: Date.now().toString(),
              app: 'insurance-protocol'
            }
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📡 Pinata response status:', response.status);

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch {
          errorDetails = await response.text();
        }

        console.error('❌ Pinata API error:', {
          status: response.status,
          statusText: response.statusText,
          details: errorDetails
        });

        if (response.status === 401) {
          throw new Error('Invalid Pinata JWT');
        } else if (response.status === 403) {
          throw new Error('Pinata API key does not have required permissions');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        } else {
          throw new Error(`Pinata API error: ${response.status} - ${response.statusText}`);
        }
      }

      const result = await response.json();
      
      if (!result.IpfsHash) {
        throw new Error('No IPFS hash returned in response');
      }

      console.log('✅ IPFS upload successful:', result.IpfsHash);
      
      return res.status(200).json({
        success: true,
        cid: result.IpfsHash,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
        size: result.PinSize || JSON.stringify(data).length
      });

    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        throw new Error('Pinata API request timeout');
      }
      throw fetchError;
    }

  } catch (error: any) {
    console.error('❌ IPFS upload failed:', error);
    
    return res.status(500).json({ 
      error: `IPFS upload failed: ${error.message}`
    });
  }
}