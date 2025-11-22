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
    
    // Use ALL available Pinata credentials
    const pinataJWT = process.env.PINATA_JWT;
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecret = process.env.PINATA_API_SECRET;

    console.log('🔐 Available credentials:', {
      hasJWT: !!pinataJWT,
      hasApiKey: !!pinataApiKey,
      hasSecret: !!pinataSecret
    });

    // Try JWT first, then API key/secret
    let authHeader = '';
    if (pinataJWT) {
      console.log('🔑 Using JWT authentication');
      authHeader = `Bearer ${pinataJWT}`;
    } else if (pinataApiKey && pinataSecret) {
      console.log('🔑 Using API key authentication');
      // For API key, we use different headers
    } else {
      throw new Error('No Pinata credentials found. Please check your environment variables.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      let response;
      
      if (pinataJWT) {
        response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            pinataContent: data,
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
      } else {
        // Use API key/secret method
        response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'pinata_api_key': pinataApiKey!,
            'pinata_secret_api_key': pinataSecret!
          },
          body: JSON.stringify({
            pinataContent: data,
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
      }

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

        throw new Error(`Pinata API error: ${response.status}`);
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