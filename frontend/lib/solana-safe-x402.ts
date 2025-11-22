// lib/solana-safe-x402.ts
'use client';

export async function createSolanaSafeX402(walletClient: any, userAddress: string, facilitatorConfig?: any) {
  try {
    console.log('🔄 Loading REAL x402 payment system...');
    
    // Import the real x402 payment system
    const x402Module = await import('./x402-real-payment');
    const X402RealPayment = x402Module.X402RealPayment;
    
    if (!X402RealPayment) {
      throw new Error('X402RealPayment not found in module');
    }

    console.log('✅ REAL x402 payment system loaded successfully');
    return new X402RealPayment(walletClient, userAddress);
    
  } catch (error: any) {
    console.error('💥 x402 RealPayment import failed:', error);
    
    // If there are Solana dependency issues, provide clear error message
    if (error.message?.includes('@solana') || error.message?.includes('Solana')) {
      throw new Error(
        'x402 payment system requires Solana dependencies. ' +
        'Please install: @solana/web3.js @solana/wallet-adapter-base @solana/wallet-adapter-wallets @solana/kit'
      );
    }
    
    throw new Error(`x402 payment system initialization failed: ${error.message}`);
  }
}