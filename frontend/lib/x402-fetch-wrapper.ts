// lib/x402-fetch-wrapper.ts
'use client';

export async function createX402FetchWrapper(walletClient: any, maxAmount: bigint = BigInt(1000000)) {
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`🔄 [${requestId}] Creating x402 fetch wrapper with maxAmount: ${maxAmount}`);

  try {
    const x402FetchModule = await import('x402-fetch');
    const wrapFetchWithPayment = x402FetchModule.wrapFetchWithPayment || x402FetchModule.default;

    if (!wrapFetchWithPayment) {
      throw new Error('wrapFetchWithPayment not found');
    }

    // Create proper wallet structure
    const compliantWallet = {
      evm: {
        chain: walletClient.chain || { id: 84532 },
        transport: walletClient.transport || { type: 'http' },
        account: walletClient.account || { 
          address: '0x2067ca3b10B136A38203723D842418C646c6e393',
          type: 'json-rpc'
        },
        
        signTypedData: async (data: any) => {
          console.log('💰 PAYMENT HEADER CREATED:');
          console.log('  - Amount:', data.message?.value, 'wei =', Number(data.message?.value) / 1000000, 'USDC');
          console.log('  - From:', data.message?.from);
          console.log('  - To:', data.message?.to);
          console.log('  - Contract:', data.domain?.verifyingContract);
          
          if (typeof walletClient.signTypedData === 'function') {
            return await walletClient.signTypedData(data);
          }
          return Promise.resolve('0x' + 'test'.repeat(16));
        },
        
        signMessage: (msg: any) => 
          walletClient.signMessage?.(msg) || Promise.resolve('0xsignature'),
        getChainId: () => 
          walletClient.getChainId?.() || Promise.resolve(84532),
        sendTransaction: (tx: any) => 
          walletClient.sendTransaction?.(tx) || Promise.resolve('0x123')
      },
      svm: {}
    };

    console.log(`✅ [${requestId}] Created compliant wallet structure`);

    // Use type assertion to bypass TypeScript error - the runtime accepts 3 args
    const fetchWithPayment = (wrapFetchWithPayment as any)(
      fetch, 
      compliantWallet, 
      maxAmount
    );

    console.log(`✅ [${requestId}] x402 fetch wrapper created successfully`);
    return fetchWithPayment;

  } catch (error: any) {
    console.error(`💥 [${requestId}] x402 fetch wrapper failed:`, error);
    throw error;
  }
}
