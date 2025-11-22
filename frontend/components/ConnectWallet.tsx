// components/ConnectWallet.tsx
import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import dynamic from 'next/dynamic';

const X402PaymentHandler = dynamic(
  () => import('./x402/X402PaymentHandler'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

interface PaymentButtonProps {
  endpoint: string;
  onSuccess: (data: any) => void;
  onError: (error: string) => void;
  className?: string;
  children: React.ReactNode;
}

export default function PaymentButton({
  endpoint,
  onSuccess,
  onError,
  className = '',
  children
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStage, setPaymentStage] = useState<'initial' | 'requesting' | 'processing'>('initial');
  const [paymentRequest, setPaymentRequest] = useState<any>(null);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  console.log('🔴 ConnectWallet state:', {
    paymentStage,
    hasPaymentRequest: !!paymentRequest,
    hasWalletClient: !!walletClient,
    hasAddress: !!address,
    isLoading
  });

  const initiateRealPayment = async () => {
    console.log('🔴 initiateRealPayment called');
    
    if (!address || !walletClient) {
      console.log('🔴 Missing address or walletClient');
      onError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setPaymentStage('requesting');

    try {
      console.log('🔴 Making initial payment request to:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress: address,
          timestamp: Date.now(),
          action: 'platform_access',
        }),
      });

      console.log('🔴 Initial response status:', response.status);

      if (response.status === 402) {
        const paymentData = await response.json();
        console.log('🔴 Payment required, setting stage to processing');
        
        setPaymentStage('processing');
        setPaymentRequest({
          ...paymentData,
          endpoint,
          userAddress: address
        });
        
        console.log('🔴 Should now render X402PaymentHandler');
        
      } else if (response.ok) {
        const data = await response.json();
        onSuccess(data);
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }

    } catch (error: any) {
      console.error('🔴 Payment initiation failed:', error);
      onError(error.message);
      setIsLoading(false);
      setPaymentStage('initial');
    }
  };

  const handlePaymentSuccess = (data: any) => {
    console.log('🔴 Payment success callback');
    setIsLoading(false);
    setPaymentStage('initial');
    setPaymentRequest(null);
    onSuccess(data);
  };

  const handlePaymentError = (error: string) => {
    console.error('🔴 Payment error callback:', error);
    setIsLoading(false);
    setPaymentStage('initial');
    setPaymentRequest(null);
    onError(error);
  };

  console.log('🔴 Render condition check:', {
    paymentStage,
    paymentRequest: !!paymentRequest,
    walletClient: !!walletClient,
    shouldRenderX402: paymentStage === 'processing' && paymentRequest && walletClient
  });

  if (paymentStage === 'processing' && paymentRequest && walletClient) {
    console.log('🔴 RENDERING X402PaymentHandler');
    return (
      <X402PaymentHandler
        paymentRequest={paymentRequest}
        walletClient={walletClient}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentError={handlePaymentError}
      />
    );
  }

  return (
    <button
      onClick={initiateRealPayment}
      disabled={isLoading || !address || !walletClient}
      className={`w-full ${className} ${
        isLoading || !address || !walletClient ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Preparing Payment...
        </div>
      ) : (
        children
      )}
    </button>
  );
}