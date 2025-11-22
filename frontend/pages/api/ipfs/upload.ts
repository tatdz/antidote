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

    // Use Pinata credentials from environment variables
    const pinataJWT = process.env.PINATA_JWT;
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecret = process.env.PINATA_API_SECRET;

    if (!pinataJWT && !(pinataApiKey && pinataSecret)) {
      return res.status(500).json({ 
        error: 'IPFS configuration error - missing credentials'
      });
    }

    console.log('📦 Uploading to IPFS...');

    // Try JWT first, then API key/secret
    let response;
    if (pinataJWT) {
      response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pinataJWT}`
        },
        body: JSON.stringify({
          pinataContent: data,
          pinataMetadata: {
            name: `claim-proof-${Date.now()}.json`
          }
        })
      });
    } else {
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
            name: `claim-proof-${Date.now()}.json`
          }
        })
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('IPFS API error:', response.status, errorText);
      throw new Error(`IPFS upload failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.IpfsHash) {
      throw new Error('No IPFS hash returned');
    }

    console.log('✅ IPFS upload successful:', result.IpfsHash);
    
    res.status(200).json({
      success: true,
      cid: result.IpfsHash,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
      size: result.PinSize
    });

  } catch (error: any) {
    console.error('IPFS upload error:', error);
    res.status(500).json({ 
      error: `IPFS upload failed: ${error.message}` 
    });
  }
}