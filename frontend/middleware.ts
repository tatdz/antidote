// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const sellerAddress = process.env.NEXT_PUBLIC_X402_SELLER_ADDRESS;

if (!sellerAddress) {
  console.error('❌ CRITICAL: NEXT_PUBLIC_X402_SELLER_ADDRESS is not set');
}

console.log('🛡️ x402 Middleware initialized');

const paymentConfig = {
  '/api/access/grant': {
    price: '1.0',
    network: "base-sepolia" as const,
  },
  '/api/insurance/purchase': {
    price: '1.0',
    network: "base-sepolia" as const,
  }
};

export async function middleware(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const pathname = request.nextUrl.pathname;
  
  console.log(`🔍 [${requestId}] x402 Middleware processing:`, { path: pathname });

  try {
    if (!sellerAddress) {
      return NextResponse.next();
    }

    if (request.headers.has('x-payment') || request.headers.has('x-payment-verified')) {
      return NextResponse.next();
    }
    
    try {
      // Use dynamic import with better error handling
      const { paymentMiddleware } = await import('x402-next');
      
      const x402Middleware = paymentMiddleware(
        sellerAddress as `0x${string}`,
        paymentConfig
      );
      
      return await x402Middleware(request);
      
    } catch (importError: any) {
      console.error(`💥 [${requestId}] x402 middleware import failed:`, importError.message);
      
      const endpointConfig = paymentConfig[pathname as keyof typeof paymentConfig];
      if (endpointConfig) {
        return new NextResponse(
          JSON.stringify({
            error: 'Payment Required',
            message: `Payment of ${endpointConfig.price} USDC required`,
            paymentRequired: true,
            amount: endpointConfig.price,
            currency: 'USDC',
            network: endpointConfig.network,
            seller: sellerAddress,
          }),
          {
            status: 402,
            headers: {
              'Content-Type': 'application/json',
              'X-Payment-Required': 'true',
            }
          }
        );
      }
      
      return NextResponse.next();
    }
    
  } catch (error: any) {
    console.error(`💥 [${requestId}] Middleware error:`, error.message);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/api/access/grant',
    '/api/insurance/purchase',
  ],
  runtime: 'nodejs' // Force Node.js runtime to avoid Edge Runtime issues
};