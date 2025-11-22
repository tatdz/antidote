// pages/api/background-tx.js
import { ethers } from 'ethers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const contractAddress = process.env.NEXT_PUBLIC_HOOK_ADDRESS_SEPOLIA;
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.ALCHEMY_ETHEREUM_SEPOLIA_URL;

    if (!contractAddress || !privateKey || !rpcUrl) {
      console.error('Missing environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const contract = new ethers.Contract(
      contractAddress,
      [
        'function checkAllActivePolicies(bytes[] calldata priceUpdateData) payable',
        'function updatePriceFeeds(bytes[] calldata priceUpdateData) payable'
      ],
      wallet
    );

    console.log('🚀 Sending background transaction from:', wallet.address);

    const tx = await contract.checkAllActivePolicies([], {
      value: ethers.parseEther('0.0003'),
      gasLimit: 800000
    });

    console.log('✅ Background Transaction Sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('✅ Background Transaction Confirmed:', receipt.hash);

    res.status(200).json({ 
      success: true, 
      txHash: tx.hash,
      confirmedHash: receipt.hash
    });

  } catch (error) {
    console.error('❌ Background transaction failed:', error);
    res.status(500).json({ error: error.message });
  }
}