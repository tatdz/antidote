// components/x402/X402PaymentHandler.tsx
'use client';

import { useEffect, useState } from 'react';
import { X402RealPayment, RealPaymentConfig } from '../../lib/x402-real-payment';

interface X402PaymentHandlerProps {
  paymentRequest: any;
  walletClient: any;
  onPaymentSuccess: (data: any) => void;
  onPaymentError: (error: string) => void;
}

export default function X402PaymentHandler({ 
  paymentRequest, 
  walletClient, 
  onPaymentSuccess, 
  onPaymentError 
}: X402PaymentHandlerProps) {
  const [status, setStatus] = useState<'initializing' | 'switching_network' | 'processing' | 'verifying' | 'completed'>('initializing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔴 X402PaymentHandler MOUNTED:', {
      hasPaymentRequest: !!paymentRequest,
      hasWalletClient: !!walletClient,
      paymentRequest,
      walletClientType: typeof walletClient
    });
    executeRealPayment();
  }, []);

  const executeRealPayment = async () => {
    try {
      console.log('🔴 X402PaymentHandler: Starting payment execution');
      setStatus('initializing');
      console.log('🔄 Starting x402 payment');

      // Initialize payment system
      console.log('🔴 X402PaymentHandler: Creating payment executor');
      const paymentExecutor = new X402RealPayment(walletClient, paymentRequest.userAddress);
      
      console.log('🔴 X402PaymentHandler: Initializing payment system');
      await paymentExecutor.initialize();

      setStatus('switching_network');
      console.log('🔴 X402PaymentHandler: Switching network');
      
      // Create payment configuration
      const paymentConfig: RealPaymentConfig = {
        endpoint: paymentRequest.endpoint,
        userAddress: paymentRequest.userAddress,
        amount: '1',
        currency: 'USDC',
        network: 'base-sepolia'
      };

      setStatus('processing');
      console.log('🔴 X402PaymentHandler: Executing real payment with config:', paymentConfig);
      
      // Execute the real payment
      const result = await paymentExecutor.executeRealPayment(paymentConfig);

      setStatus('verifying');
      console.log('✅ X402PaymentHandler: Payment completed successfully:', result);
      setStatus('completed');
      
      setTimeout(() => {
        onPaymentSuccess(result);
      }, 1000);

    } catch (error: any) {
      console.error('💥 X402PaymentHandler: Payment execution failed:', error);
      console.error('💥 Error stack:', error.stack);
      setError(error.message);
      onPaymentError(error.message);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'initializing': return 'Initializing payment system...';
      case 'switching_network': return 'Switching to Base Sepolia...';
      case 'processing': return 'Processing payment...';
      case 'verifying': return 'Verifying payment...';
      case 'completed': return 'Payment completed!';
      default: return 'Processing...';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🔐 Processing Payment
      </h3>
      
      <div className="space-y-4">
        {status !== 'completed' && !error && (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600">{getStatusText()}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={executeRealPayment}
              className="mt-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded"
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-sm text-green-800">Payment completed successfully!</p>
          </div>
        )}
      </div>
    </div>
  );
}