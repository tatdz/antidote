import type { NextApiRequest, NextApiResponse } from 'next';

const CHAIN_RPC_URLS = {
  sepolia: process.env.ALCHEMY_ETHEREUM_SEPOLIA_URL,
  baseSepolia: process.env.ALCHEMY_BASE_SEPOLIA_URL,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { method, params, chain = 'sepolia' } = req.body;
  const rpcUrl = CHAIN_RPC_URLS[chain as keyof typeof CHAIN_RPC_URLS];

  if (!rpcUrl) {
    return res.status(400).json({ error: 'Unsupported chain' });
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1,
      }),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('RPC call failed:', error);
    res.status(500).json({ error: 'RPC call failed' });
  }
}