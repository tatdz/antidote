// lib/x402-real-payment.ts
'use client';

import { loadFacilitatorConfig, FacilitatorConfig } from './facilitator-loader';

export interface RealPaymentConfig {
  endpoint: string;
  userAddress: string;
  amount: string;
  currency: string;
  network: string;
}

export class X402RealPayment {
  private walletClient: any;
  private userAddress: string;
  private facilitatorConfig: FacilitatorConfig | null = null;

  constructor(walletClient: any, userAddress: string) {
    this.walletClient = walletClient;
    this.userAddress = userAddress;
  }

  async initialize(): Promise<void> {
    const startTime = Date.now();
    console.log('🔄 Initializing x402 payment system with CDP facilitator...');
    
    try {
      this.facilitatorConfig = await loadFacilitatorConfig(this.userAddress);
      
      if (this.facilitatorConfig) {
        console.log('✅ CDP facilitator configured successfully:', {
          hasUrl: !!this.facilitatorConfig.url,
          hasCreateAuthHeaders: !!this.facilitatorConfig.createAuthHeaders,
          loadTime: `${Date.now() - startTime}ms`
        });

        // Test CDP authentication (handle base64url errors gracefully)
        try {
          const authHeaders = await this.facilitatorConfig.createAuthHeaders();
          console.log('🔐 CDP Authentication headers generated:', {
            verifyHeaders: Object.keys(authHeaders.verify).length,
            settleHeaders: Object.keys(authHeaders.settle).length,
            supportedHeaders: Object.keys(authHeaders.supported).length,
            listHeaders: Object.keys(authHeaders.list).length
          });
        } catch (authError: any) {
          console.warn('⚠️ CDP Authentication header generation failed (non-critical):', authError.message);
          // Continue without CDP auth headers - payment will still work
        }
      } else {
        console.warn('⚠️ No CDP facilitator config available - x402 payments will work without compliance features');
      }
    } catch (error: any) {
      console.error('💥 CDP facilitator initialization failed:', error.message);
      this.facilitatorConfig = null;
    }
  }

  async switchToPaymentNetwork(): Promise<void> {
    const PAYMENT_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_PAYMENT_CHAIN_ID || '84532');
    const currentChainId = await this.walletClient.getChainId();
    
    console.log('📡 Network status:', {
      currentChainId,
      targetChainId: PAYMENT_CHAIN_ID,
      isCorrectNetwork: currentChainId === PAYMENT_CHAIN_ID
    });

    if (currentChainId !== PAYMENT_CHAIN_ID) {
      console.log(`🔄 Switching from chain ${currentChainId} to Base Sepolia (${PAYMENT_CHAIN_ID})`);
      
      try {
        await this.walletClient.switchChain({ id: PAYMENT_CHAIN_ID });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const newChainId = await this.walletClient.getChainId();
        if (newChainId === PAYMENT_CHAIN_ID) {
          console.log('✅ Successfully switched to Base Sepolia');
        } else {
          throw new Error(`Failed to switch to Base Sepolia. Current chain: ${newChainId}`);
        }
      } catch (switchError: any) {
        console.error('💥 Chain switch failed:', switchError.message);
        throw new Error('Please manually switch to Base Sepolia in your wallet to complete payment');
      }
    } else {
      console.log('✅ Already on Base Sepolia');
    }
  }

  async executeRealPayment(config: RealPaymentConfig): Promise<any> {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();
    
    console.log(`🚀 [${requestId}] Starting REAL x402 payment execution:`, {
      endpoint: config.endpoint,
      userAddress: config.userAddress,
      amount: config.amount,
      currency: config.currency,
      network: config.network
    });

    try {
      // Ensure system is initialized
      if (!this.facilitatorConfig) {
        console.log(`🔄 [${requestId}] Initializing payment system...`);
        await this.initialize();
      }

      // Log CDP status
      console.log(`🔐 [${requestId}] CDP Facilitator status:`, {
        hasFacilitator: !!this.facilitatorConfig,
        usingCompliance: !!this.facilitatorConfig
      });

      // Switch to Base Sepolia first
      console.log(`🌐 [${requestId}] Switching to payment network...`);
      await this.switchToPaymentNetwork();

      // Use x402-fetch wrapper
      console.log(`📦 [${requestId}] Loading x402-fetch wrapper...`);
      const { createX402FetchWrapper } = await import('./x402-fetch-wrapper');
      
      // FIXED: Remove maxAllowedAmount and just use the wrapper
      const fetchWithPayment = await createX402FetchWrapper(this.walletClient);

      // Execute the payment request
      console.log(`💳 [${requestId}] Executing REAL x402 payment request to: ${config.endpoint}`);
      const paymentStartTime = Date.now();
      
      const response = await fetchWithPayment(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Address': this.userAddress,
        },
        body: JSON.stringify({
          userAddress: this.userAddress,
          timestamp: Date.now(),
          action: 'platform_access',
        }),
      });

      const paymentTime = Date.now() - paymentStartTime;
      console.log(`📨 [${requestId}] x402 payment response received:`, {
        status: response.status,
        statusText: response.statusText,
        processingTime: `${paymentTime}ms`,
        headers: Object.fromEntries(response.headers)
      });

      if (response.status === 402) {
        // Payment required but not processed
        const errorData = await response.json();
        console.log(`💰 [${requestId}] Payment required:`, errorData);
        throw new Error(errorData.message || 'Payment of 1.0 USDC required');
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.log(`❌ [${requestId}] Payment error details:`, errorData);
        } catch (e) {
          errorData = { message: 'Payment failed - could not parse error response' };
        }
        
        console.error(`💥 [${requestId}] Payment failed:`, {
          status: response.status,
          error: errorData.message
        });
        
        throw new Error(errorData.message || `Payment failed with status ${response.status}`);
      }

      const result = await response.json();
      const totalTime = Date.now() - startTime;
      
      console.log(`🎉 [${requestId}] REAL x402 PAYMENT COMPLETED SUCCESSFULLY!`, {
        result,
        totalProcessingTime: `${totalTime}ms`,
        accessGranted: result.accessGranted,
        userData: result.userData
      });
      
      return result;

    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`💥 [${requestId}] REAL x402 PAYMENT EXECUTION FAILED:`, {
        error: error.message,
        stack: error.stack,
        totalTime: `${totalTime}ms`,
        userAddress: this.userAddress,
        endpoint: config.endpoint
      });
      
      // Provide specific error messages
      if (error.message?.includes('user rejected')) {
        throw new Error('Payment was cancelled by user');
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient USDC balance on Base Sepolia');
      } else if (error.message?.includes('switch to Base Sepolia')) {
        throw new Error('Please switch to Base Sepolia network to complete payment');
      } else if (error.message?.includes('@solana') || error.message?.includes('Solana')) {
        throw new Error('Payment system configuration updating - please try the payment again');
      }
      
      throw error;
    }
  }
}
