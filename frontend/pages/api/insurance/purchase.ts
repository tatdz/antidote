// pages/api/insurance/purchase.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { address, collateralAmount, debtAmount } = req.body;

    if (!address || !collateralAmount || !debtAmount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    console.log('🛡️ Insurance purchase request:', { address, collateralAmount, debtAmount });

    // ON TESTNET: x402 middleware handles payment verification
    const paymentVerified = req.headers['x-payment-verified'] === 'true';

    if (!paymentVerified) {
      return res.status(402).json({
        success: false,
        message: 'Insurance premium payment verification failed',
      });
    }

    // Calculate insurance premium (same logic as before)
    const collateralValue = parseFloat(collateralAmount) * 3500;
    const debtValue = parseFloat(debtAmount);
    
    if (debtValue === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid debt amount' 
      });
    }

    const collateralizationRatio = (collateralValue * 100) / debtValue;
    const basePremium = collateralValue * 0.02;
    const riskFactor = Math.max(1, 100 / collateralizationRatio);
    const totalPremiumUSD = basePremium + (basePremium * riskFactor);
    const premiumInETH = (totalPremiumUSD / 3500).toFixed(6);
    const coverageInETH = ((collateralValue * 0.8) / 3500).toFixed(6);

    console.log('📊 Insurance calculation completed');

    // Return success - x402 testnet handled the payment
    res.status(200).json({
      success: true,
      premium: premiumInETH,
      coverage: coverageInETH,
      message: 'Margin call insurance purchased successfully!',
      insuranceData: {
        policyId: `antidote-policy-${Date.now()}`,
        coverageAmount: coverageInETH,
        premiumAmount: premiumInETH,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }
    });

  } catch (error: any) {
    console.error('❌ Insurance purchase failed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}