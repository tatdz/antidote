// components/x402/PaymentButton.tsx
import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import dynamic from 'next/dynamic';

// Load the real X402PaymentHandler
const X402PaymentHandler = dynamic(
  () => import('./X402PaymentHandler'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-600">Initializing payment system...</span>
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

  useEffect(() => {
    console.log('🔴 PaymentButton MOUNTED:', {
      initialAddress: !!address,
      initialWalletClient: !!walletClient,
      paymentStage,
      hasPaymentRequest: !!paymentRequest
    });
  }, []);

  const initiateRealPayment = async () => {
    if (!address || !walletClient) {
      console.log('🔴 PaymentButton: Missing address or walletClient', {
        address: !!address,
        walletClient: !!walletClient
      });
      onError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setPaymentStage('requesting');

    console.log('🔴 PaymentButton: Starting payment flow', {
      address,
      hasWalletClient: !!walletClient,
      endpoint
    });

    try {
      console.log('🔴 PaymentButton: Making initial request to check payment requirements');
      
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

      console.log('🔴 PaymentButton: Initial response:', {
        status: response.status,
        statusText: response.statusText
      });

      if (response.status === 402) {
        const paymentData = await response.json();
        console.log('🔴 PaymentButton: 402 received, proceeding to x402 payment', paymentData);
        
        setPaymentStage('processing');
        setPaymentRequest({
          ...paymentData,
          endpoint,
          userAddress: address
        });
        
        console.log('🔴 PaymentButton: Should now render X402PaymentHandler');
        
      } else if (response.ok) {
        const data = await response.json();
        console.log('🔴 PaymentButton: Direct access granted (no payment needed)');
        onSuccess(data);
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }

    } catch (error: any) {
      console.error('💥 PaymentButton: Payment initiation failed:', error);
      onError(error.message);
      setIsLoading(false);
      setPaymentStage('initial');
    }
  };

  const handlePaymentSuccess = (data: any) => {
    console.log('🎉 Payment completed');
    setIsLoading(false);
    setPaymentStage('initial');
    setPaymentRequest(null);
    onSuccess(data);
  };

  const handlePaymentError = (error: string) => {
    console.error('💥 Payment failed:', error);
    setIsLoading(false);
    setPaymentStage('initial');
    setPaymentRequest(null);
    onError(error);
  };

  console.log('🔴 PaymentButton RENDER STATE:', {
    paymentStage,
    paymentRequest: !!paymentRequest,
    walletClient: !!walletClient,
    address: !!address,
    isLoading,
    shouldRenderX402: paymentStage === 'processing' && paymentRequest && walletClient
  });

  if (paymentStage === 'processing' && paymentRequest && walletClient) {
    console.log('🔴 PaymentButton: RENDERING X402PaymentHandler');
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