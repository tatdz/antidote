// ImprovedDashboard.tsx - COMPLETE REWRITE
import { useState, useEffect } from 'react';
import { 
  useAccount, 
  usePublicClient, 
  useChainId, 
  useWalletClient, 
  useConnect, 
  useDisconnect 
} from 'wagmi';
import { injected } from 'wagmi/connectors';
import PaymentButton from './x402/PaymentButton';
import InsuranceDashboard from './InsuranceDashboard';
import SecondaryTrading from './SecondaryTrading';
import CombinedMonitor from './CombinedMonitor';
import ClaimsHistory from './ClaimsHistory';
import AntidoteAccessGate from './AntidoteAccessGate';
import { getChainConfig } from '../lib/chain-config';

type TabType = 'insurance' | 'trading' | 'monitor' | 'claims';

// ConnectWalletButton component
const ConnectWalletButton = () => {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-3 items-center">
        <button 
          onClick={() => {
            console.log('🔗 Connecting wallet...');
            connect({ connector: injected() });
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors shadow-md w-full max-w-xs"
        >
          🔗 Connect Wallet
        </button>
        <p className="text-xs text-gray-600 text-center max-w-xs whitespace-nowrap">
          Connect your Ethereum wallet (MetaMask, etc.)
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-2 rounded-full text-sm border border-green-200">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
      </div>
      
      <button 
        onClick={() => disconnect()}
        className="bg-gray-500 hover:bg-gray-600 text-white text-sm px-3 py-2 rounded transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
};

export default function ImprovedDashboard() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  
  const [activeTab, setActiveTab] = useState<TabType>('insurance');
  const [hasAccess, setHasAccess] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<any>(null);

  // Debug logging
  useEffect(() => {
    console.log('🔐 ImprovedDashboard - State:', {
      isConnected,
      address,
      hasAccess,
      isCheckingAccess,
      chainId,
      localStorage: address ? localStorage.getItem(`antidote-access-${address}`) : 'no address'
    });
  }, [isConnected, address, hasAccess, isCheckingAccess, chainId]);

  // Check user access - session expires immediately on wallet disconnect
  const checkUserAccess = async () => {
    console.log('🔐 checkUserAccess called:', { address, isConnected });
    
    if (!address || !isConnected) {
      // Clear access when wallet disconnects
      if (address) {
        localStorage.removeItem(`antidote-access-${address}`);
        console.log('🔐 Cleared access for disconnected wallet:', address);
      }
      setHasAccess(false);
      setIsCheckingAccess(false);
      return;
    }

    setIsCheckingAccess(true);
    try {
      // Check if user has access in current session (only valid while connected)
      const hasSessionAccess = localStorage.getItem(`antidote-access-${address}`) === 'true';
      console.log('🔐 Session access check:', { address, hasSessionAccess });
      
      setHasAccess(hasSessionAccess);
      
      if (hasSessionAccess) {
        console.log('✅ User has session access while connected:', address);
      } else {
        console.log('❌ User needs to pay for access:', address);
      }
    } catch (error) {
      console.error('❌ Failed to check user access:', error);
      setHasAccess(false);
    } finally {
      setIsCheckingAccess(false);
    }
  };

  // Handle access success - store session only while connected
  const handleAccessSuccess = async (data: any) => {
    console.log('🎉 Access success:', data);
    if (address && isConnected) {
      localStorage.setItem(`antidote-access-${address}`, 'true');
      console.log('✅ Access granted for session:', address);
      
      // Switch to Sepolia Ethereum after successful payment
      try {
        console.log('🔄 Switching to Sepolia Ethereum for Antidote usage...');
        if (window.ethereum) {
          const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
          
          // If we're on Base Sepolia (payment network), switch to Sepolia
          if (currentChainId === '0x14a34') {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xaa36a7' }], // Switch to Sepolia
            });
            console.log('✅ Switched to Sepolia Ethereum');
          }
        }
      } catch (switchError) {
        console.log('⚠️ Could not switch networks automatically, but access is granted');
      }
      
      setHasAccess(true);
      
      // Refresh to show the main dashboard
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  // Clear access when wallet disconnects
  useEffect(() => {
    if (!isConnected && address) {
      console.log('🔐 Wallet disconnected, clearing access for:', address);
      localStorage.removeItem(`antidote-access-${address}`);
      setHasAccess(false);
    }
  }, [isConnected, address]);

  // Load access status when address or connection changes
  useEffect(() => {
    checkUserAccess();
    
    const config = getChainConfig(chainId);
    setNetworkInfo(config);
    console.log('🌐 Network info:', config);
  }, [address, isConnected, chainId]);

  // Clear access function for debugging
  const clearAccess = () => {
    if (address) {
      localStorage.removeItem(`antidote-access-${address}`);
      console.log('🧹 Manually cleared access for:', address);
      setHasAccess(false);
      window.location.reload();
    }
  };

if (!isConnected) {
  console.log('🔐 Showing connect wallet screen');
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🛡️</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Antidote</h1>
        <p className="text-lg text-gray-600 mb-6 whitespace-nowrap">
          Margin Call Protection powered by Uniswap v4 & Pyth Oracles
        </p>
        <ConnectWalletButton />
      </div>
    </div>
  );
}

  console.log('🔐 Access check results:', { hasAccess, isCheckingAccess });

  // Show loading while checking access
  if (isCheckingAccess) {
    console.log('🔐 Showing access checking screen');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking platform access...</p>
          <button 
            onClick={clearAccess}
            className="mt-4 text-sm text-red-600 underline"
          >
            Reset Access
          </button>
        </div>
      </div>
    );
  }

  // Show access gate if user hasn't paid
  if (!hasAccess) {
    console.log('🔐 Showing payment gate - no access');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <AntidoteAccessGate onAccessSuccess={handleAccessSuccess} />
        </div>
      </div>
    );
  }

  console.log('🔐 Showing main dashboard - access granted');
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded">
                <span>✅</span>
                <span>Paid Access</span>
              </div>
              <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded">
                <span>🛡️</span>
                <span>x402 Verified</span>
              </div>
              {/* Debug button */}
              <button 
                onClick={clearAccess}
                className="flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded text-xs"
              >
                <span>🧹</span>
                <span>Reset Access</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ConnectWalletButton />
            </div>
          </div>

          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="text-3xl">🛡️</div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">Antidote</div>
                  <div className="text-sm text-gray-500">Margin Call Protection</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Navigation - Equally spaced tabs */}
          <nav className="flex justify-between space-x-1">
            {[
              { id: 'insurance', label: 'Insurance', icon: '🛡️' },
              { id: 'trading', label: 'Secondary Market Trading', icon: '💹' },
              { id: 'monitor', label: 'Monitor', icon: '📊' },
              { id: 'claims', label: 'Claims History', icon: '📋' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex-1 flex flex-col items-center justify-center py-3 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="text-xl mb-1">{tab.icon}</div>
                <div className="text-xs font-medium text-center leading-tight">
                  {tab.label}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area - Full width */}
          <div className="lg:col-span-4">
            {activeTab === 'insurance' && <InsuranceDashboard />}
            {activeTab === 'trading' && <SecondaryTrading />}
            {activeTab === 'monitor' && <CombinedMonitor />}
            {activeTab === 'claims' && <ClaimsHistory />}
          </div>
        </div>
      </main>
    </div>
  );
}