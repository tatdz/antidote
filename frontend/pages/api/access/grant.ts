// pages/api/access/grant.ts
import type { NextApiRequest, NextApiResponse } from 'next';

interface GrantAccessResponse {
  success: boolean;
  accessGranted: boolean;
  message?: string;
  userData?: {
    address: string;
    accessGrantedAt: string;
    paymentVerified: boolean;
    cdpCompliant: boolean;
  };
}

function parseX402PaymentHeader(xPaymentHeader: string | string[] | undefined) {
  if (!xPaymentHeader) {
    console.log('🔍 No x-payment header provided');
    return null;
  }
  
  try {
    const headerStr = Array.isArray(xPaymentHeader) ? xPaymentHeader[0] : xPaymentHeader;
    console.log('🔍 Raw x-payment header length:', headerStr.length);
    
    const decoded = JSON.parse(Buffer.from(headerStr, 'base64').toString());
    
    console.log('✅ Successfully parsed x402 payment header:', {
      version: decoded.x402Version,
      scheme: decoded.scheme,
      network: decoded.network,
      hasPayload: !!decoded.payload,
      hasAuthorization: !!decoded.payload?.authorization
    });
    
    return decoded;
  } catch (error: any) {
    console.error('💥 Failed to parse x402 payment header:', {
      error: error.message
    });
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GrantAccessResponse>
) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  console.log(`🚀 [${requestId}] API /access/grant called:`, {
    method: req.method,
    path: req.url,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });

  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return res.status(405).json({ 
      success: false, 
      accessGranted: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { userAddress, address } = req.body;
    const walletAddress = userAddress || address;
    
    console.log(`👤 [${requestId}] User details:`, {
      userAddress,
      address,
      resolvedWalletAddress: walletAddress
    });
    
    if (!walletAddress) {
      console.log(`❌ [${requestId}] No wallet address provided`);
      return res.status(400).json({ 
        success: false, 
        accessGranted: false, 
        message: 'Wallet address is required' 
      });
    }

    console.log(`🔐 [${requestId}] Access grant request for: ${walletAddress}`);

    // Check for x402 payment header
    const xPaymentHeader = req.headers['x-payment'];
    console.log(`💰 [${requestId}] Payment header status:`, {
      hasPaymentHeader: !!xPaymentHeader,
      headerType: typeof xPaymentHeader
    });

    // If there's a payment header, try to verify it
    if (xPaymentHeader) {
      const paymentData = parseX402PaymentHeader(xPaymentHeader);
      
      if (paymentData && paymentData.payload?.authorization) {
        const auth = paymentData.payload.authorization;
        
        console.log(`✅ [${requestId}] Valid payment data received:`, {
          scheme: paymentData.scheme,
          network: paymentData.network,
          from: auth.from,
          to: auth.to,
          value: auth.value,
          validAfter: auth.validAfter,
          validBefore: auth.validBefore,
          nonce: auth.nonce ? `${auth.nonce.substring(0, 16)}...` : 'none'
        });

        // Verify the payment matches our requirements
        const expectedTo = process.env.NEXT_PUBLIC_X402_SELLER_ADDRESS;
        const expectedValue = '1000000'; // 1 USDC in base units
        
        if (!expectedTo) {
          console.error(`❌ [${requestId}] NEXT_PUBLIC_X402_SELLER_ADDRESS is not set`);
          return res.status(500).json({
            success: false,
            accessGranted: false,
            message: 'Server configuration error'
          });
        }

        // Case-insensitive address comparison
        const addressMatches = auth.to?.toLowerCase() === expectedTo.toLowerCase();
        const valueMatches = auth.value === expectedValue;

        console.log(`🔍 [${requestId}] Payment verification analysis:`, {
          addressMatches,
          valueMatches,
          expectedTo: expectedTo.toLowerCase(),
          actualTo: auth.to?.toLowerCase(),
          expectedValue,
          actualValue: auth.value,
          valueExplanation: `${auth.value} = ${parseInt(auth.value) / 1000000} USDC`
        });

        if (addressMatches && valueMatches) {
          console.log(`🎉 [${requestId}] PAYMENT VERIFIED SUCCESSFULLY!`);
          console.log(`🎉 [${requestId}] Granting platform access to: ${walletAddress}`);

          const accessGrantedAt = new Date().toISOString();
          const processingTime = Date.now() - startTime;
          
          console.log(`⏱️ [${requestId}] Request processed in ${processingTime}ms`);
          
          return res.status(200).json({
            success: true,
            accessGranted: true,
            message: `Platform access granted! Welcome to Antidote.`,
            userData: {
              address: walletAddress,
              accessGrantedAt,
              paymentVerified: true,
              cdpCompliant: false // Will be true when CDP is working
            }
          });
        } else {
          console.log(`❌ [${requestId}] Payment verification failed:`, {
            reason: !addressMatches ? 'Recipient address mismatch' : 'Payment amount mismatch'
          });
        }
      } else {
        console.log(`❌ [${requestId}] Invalid payment data structure`);
      }
    } else {
      console.log(`❌ [${requestId}] No x-payment header found in request`);
    }

    // If we get here, no valid payment was found
    console.log(`💰 [${requestId}] Returning 402 - Payment verification required`);
    
    return res.status(402).json({
      success: false,
      accessGranted: false,
      message: 'Payment verification required',
    });

  } catch (error: any) {
    console.error(`💥 [${requestId}] CRITICAL ERROR in access grant:`, {
      error: error.message,
      stack: error.stack
    });
    
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ [${requestId}] Request failed after ${processingTime}ms`);
    
    return res.status(500).json({ 
      success: false, 
      accessGranted: false, 
      message: `Internal server error` 
    });
  }
}