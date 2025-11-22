// components/AntidoteAccessGate.tsx
import { useState, useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import PaymentButton from './x402/PaymentButton';

interface AntidoteAccessGateProps {
  onAccessSuccess?: (data: any) => void;
}

export default function AntidoteAccessGate({ onAccessSuccess }: AntidoteAccessGateProps) {
  const [accessStatus, setAccessStatus] = useState<'checking' | 'pending' | 'granted' | 'denied'>('checking');
  const [message, setMessage] = useState('');
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const PLATFORM_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_PLATFORM_CHAIN_ID || '11155111');
  const PAYMENT_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_PAYMENT_CHAIN_ID || '84532');

  // Check access status and network
  useEffect(() => {
    if (!isConnected || !address) {
      setAccessStatus('pending');
      setMessage('Connect wallet to continue');
      return;
    }

    const hasSessionAccess = localStorage.getItem(`antidote-access-${address}`) === 'true';
    const isOnPlatformNetwork = chainId === PLATFORM_CHAIN_ID;
    const isOnPaymentNetwork = chainId === PAYMENT_CHAIN_ID;
    
    console.log('🔍 Access gate status check:', {
      hasSessionAccess,
      isOnPlatformNetwork,
      isOnPaymentNetwork,
      currentChainId: chainId,
      platformChainId: PLATFORM_CHAIN_ID,
      paymentChainId: PAYMENT_CHAIN_ID
    });

    if (hasSessionAccess && isOnPlatformNetwork) {
      setAccessStatus('granted');
      setMessage('Access granted - ready to use platform');
    } else if (hasSessionAccess && !isOnPlatformNetwork) {
      setAccessStatus('pending');
      setMessage('Switch to Ethereum Sepolia for platform access');
    } else {
      setAccessStatus('pending');
      setMessage('Payment required for access');
    }
  }, [address, isConnected, chainId, PLATFORM_CHAIN_ID, PAYMENT_CHAIN_ID]);

  const handleAccessSuccess = async (data: any) => {
    console.log('🎉 Payment successful, processing access grant...');
    setAccessStatus('granted');
    setMessage('Payment verified! Granting access...');
    
    // Store access in localStorage
    if (address) {
      localStorage.setItem(`antidote-access-${address}`, 'true');
      console.log('💾 Access stored in localStorage for session');
    }
    
    // Switch to Ethereum Sepolia for platform access
    try {
      const currentChainId = chainId;
      console.log(`🌐 Current network: ${currentChainId}, Target: ${PLATFORM_CHAIN_ID}`);
      
      if (currentChainId !== PLATFORM_CHAIN_ID) {
        setMessage('Switching to Ethereum Sepolia for platform access...');
        console.log(`🔄 Switching from chain ${currentChainId} to Ethereum Sepolia (${PLATFORM_CHAIN_ID})`);
        
        await switchChain({ chainId: PLATFORM_CHAIN_ID });
        
        // Wait for network switch to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('✅ Network switch completed (or in progress)');
        setMessage('Access granted! Welcome to Antidote.');
      } else {
        setMessage('Access granted! Welcome to Antidote.');
      }
    } catch (switchError: any) {
      console.warn('⚠️ Network switch failed or was cancelled:', switchError);
      setMessage('Access granted! Please switch to Ethereum Sepolia manually for full platform access.');
    }
    
    // Call the success callback
    if (onAccessSuccess) {
      onAccessSuccess(data);
    }
    
    // Refresh the page to ensure clean state
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handleAccessError = (error: string) => {
    console.error('💥 Access verification failed:', error);
    setAccessStatus('denied');
    setMessage(`Payment failed: ${error}`);
    
    setTimeout(() => {
      setAccessStatus('pending');
      setMessage('Payment required for access');
    }, 5000);
  };




  const handleSwitchToPlatform = async () => {
    try {
      setMessage('Switching to Ethereum Sepolia...');
      await switchChain({ chainId: PLATFORM_CHAIN_ID });
      setMessage('Switched to Ethereum Sepolia');
    } catch (error) {
      console.error('💥 Network switch failed:', error);
      setMessage('Please switch to Ethereum Sepolia manually in your wallet');
    }
  };

  const handleSwitchToPayment = async () => {
    try {
      setMessage('Switching to Base Sepolia for payment...');
      await switchChain({ chainId: PAYMENT_CHAIN_ID });
      setMessage('Switched to Base Sepolia - ready for payment');
    } catch (error) {
      console.error('💥 Network switch failed:', error);
      setMessage('Please switch to Base Sepolia manually in your wallet');
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <div className="text-4xl mb-4">🔐</div>
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
          Connect Wallet
        </h3>
        <p className="text-yellow-700">
          Connect your wallet to access Antidote
        </p>
      </div>
    );
  }

  if (accessStatus === 'checking') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-blue-700">Checking access status...</p>
      </div>
    );
  }

  if (accessStatus === 'granted') {
    const hasSessionAccess = localStorage.getItem(`antidote-access-${address}`) === 'true';
    const isOnPlatformNetwork = chainId === PLATFORM_CHAIN_ID;

    if (hasSessionAccess && isOnPlatformNetwork) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Access Granted
          </h3>
          <p className="text-green-700">Welcome to Antidote! Loading platform...</p>
        </div>
      );
    }

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
        <div className="text-4xl mb-4">🔄</div>
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          Switch Network
        </h3>
        <p className="text-blue-700 mb-4">{message}</p>
        <button
          onClick={handleSwitchToPlatform}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors w-full"
        >
          Switch to Ethereum Sepolia
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
      <div className="text-4xl mb-4">🛡️</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Institutional Access
      </h3>
      <p className="text-gray-600 mb-6">
        To access Antidote, institutions pay 1 USDC to verify their wallets with Coinbase x402
      </p>

      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm text-blue-700 space-y-1">
            <div className="flex justify-between">
              <span>Verification Fee:</span>
              <span className="font-medium">1 USDC</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Network:</span>
              <span className="font-medium">Base Sepolia</span>
            </div>
            <div className="flex justify-between">
              <span>Platform Network:</span>
              <span className="font-medium">Ethereum Sepolia</span>
            </div>
            <div className="flex justify-between">
              <span>Current Network:</span>
              <span className="font-medium">
                {chainId === PLATFORM_CHAIN_ID ? 'Ethereum Sepolia' : 
                 chainId === PAYMENT_CHAIN_ID ? 'Base Sepolia' : 
                 `Other (${chainId})`}
              </span>
            </div>
          </div>
        </div>

        {chainId !== PAYMENT_CHAIN_ID && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-700 mb-2">
              You need to be on Base Sepolia to make the payment
            </p>
            <button
              onClick={handleSwitchToPayment}
              className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium py-2 px-3 rounded w-full"
            >
              Switch to Base Sepolia
            </button>
          </div>
        )}

        {chainId === PAYMENT_CHAIN_ID && (
          <PaymentButton
            endpoint="/api/access/grant"
            onSuccess={handleAccessSuccess}
            onError={handleAccessError}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Verify with Coinbase x402 - 1 USDC
          </PaymentButton>
        )}

        {message && (
          <div className={`mt-4 p-3 rounded-lg ${
            accessStatus === 'denied' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'
          }`}>
            {message}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500">
          <p>Coinbase x402 Verification • Real USDC Payment • CDP Compliance</p>
        </div>
      </div>
    </div>
  );
}