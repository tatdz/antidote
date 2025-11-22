// components/CombinedMonitor.tsx
import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useChainId } from 'wagmi';
import { ethers } from 'ethers';
import { pythService } from '../lib/pyth-service';
import { PYTH_FEED_IDS, getChainConfig } from '../lib/chain-config';

// Use the same ABI as your InsuranceDashboard
const MARGIN_CALL_HOOK_ABI = [
  {
    "type": "function",
    "name": "getContractBalance",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function", 
    "name": "policies",
    "inputs": [{"name": "", "type": "address"}],
    "outputs": [
      {"name": "user", "type": "address"},
      {"name": "collateralAmount", "type": "uint256"},
      {"name": "collateralFeedId", "type": "bytes32"},
      {"name": "debtAmount", "type": "uint256"},
      {"name": "debtFeedId", "type": "bytes32"},
      {"name": "marginThreshold", "type": "uint256"},
      {"name": "premiumPaid", "type": "uint256"},
      {"name": "coverageAmount", "type": "uint256"},
      {"name": "active", "type": "bool"},
      {"name": "startTime", "type": "uint256"},
      {"name": "lastCheck", "type": "uint256"},
      {"name": "paymentToken", "type": "address"}
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicyStatus",
    "inputs": [{"name": "user", "type": "address"}],
    "outputs": [
      {"name": "active", "type": "bool"},
      {"name": "collateralizationRatio", "type": "uint256"},
      {"name": "premium", "type": "uint256"},
      {"name": "coverage", "type": "uint256"},
      {"name": "lastCheck", "type": "uint256"},
      {"name": "paymentToken", "type": "address"}
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTotalActivePolicies",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getLatestPrice",
    "inputs": [{"name": "feedId", "type": "bytes32"}],
    "outputs": [
      {"name": "price", "type": "int64"},
      {"name": "confidence", "type": "uint64"},
      {"name": "expo", "type": "int32"}
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "checkAllActivePolicies",
    "inputs": [{"name": "priceUpdateData", "type": "bytes[]"}],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "updatePriceFeeds",
    "inputs": [{"name": "priceUpdateData", "type": "bytes[]"}],
    "outputs": [],
    "stateMutability": "payable"
  }
] as const;

interface MonitoringEvent {
  type: 'margin_check' | 'price_update' | 'policy_triggered';
  timestamp: number;
  message: string;
  severity: 'info' | 'warning' | 'danger';
}

interface SystemStatus {
  totalPolicies: number;
  contractBalance: string;
  lastPriceUpdate: number;
}

export default function CombinedMonitor() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    totalPolicies: 0,
    contractBalance: '0',
    lastPriceUpdate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [userMarginStatus, setUserMarginStatus] = useState<{ratio: number; status: string; color: string} | null>(null);
  const [showInsurancePoolInfo, setShowInsurancePoolInfo] = useState(false);
  const [showPositionStatusInfo, setShowPositionStatusInfo] = useState(false);

  const addEvent = useCallback((event: Omit<MonitoringEvent, 'timestamp'>) => {
    const newEvent: MonitoringEvent = {
      ...event,
      timestamp: Date.now()
    };
    setEvents(prev => [newEvent, ...prev.slice(0, 9)]); // Keep last 10 events
  }, []);

  const getContractAddresses = useCallback(() => {
    const config = getChainConfig(chainId);
    return {
      hookAddress: config?.hookAddress,
    };
  }, [chainId]);

  // Background TxID Generation via API
  const generateBackgroundTxIDs = useCallback(async () => {
    try {
      console.log('🚀 Starting background TxID generation via API...');

      const response = await fetch('/api/background-tx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Background Transaction Successful:', data.txHash);
        console.log('🔗 View on Etherscan: https://sepolia.etherscan.io/tx/' + data.txHash);
        console.log('✅ Transaction Confirmed:', data.confirmedHash);
        
        // Optional: Add to events feed if you want UI visibility
        addEvent({
          type: 'price_update',
          message: `Auto-check completed: ${data.txHash.slice(0, 10)}...`,
          severity: 'info'
        });
      } else {
        const error = await response.json();
        console.error('❌ Background transaction failed:', error.error);
      }

    } catch (error: any) {
      console.error('❌ Background transaction API call failed:', error.message);
    }
  }, [addEvent]);

  const loadSystemStatus = useCallback(async () => {
    const { hookAddress } = getContractAddresses();
    if (!publicClient || !hookAddress) return;

    try {
      const [totalPolicies, contractBalance, ethPriceData, usdcPriceData] = await Promise.all([
        publicClient.readContract({
          address: hookAddress as `0x${string}`,
          abi: MARGIN_CALL_HOOK_ABI,
          functionName: 'getTotalActivePolicies',
          args: []
        }),
        publicClient.getBalance({ address: hookAddress as `0x${string}` }),
        publicClient.readContract({
          address: hookAddress as `0x${string}`,
          abi: MARGIN_CALL_HOOK_ABI,
          functionName: 'getLatestPrice',
          args: [PYTH_FEED_IDS.ETH_USD]
        }),
        publicClient.readContract({
          address: hookAddress as `0x${string}`,
          abi: MARGIN_CALL_HOOK_ABI,
          functionName: 'getLatestPrice',
          args: [PYTH_FEED_IDS.USDC_USD]
        })
      ]);

      setSystemStatus({
        totalPolicies: Number(totalPolicies),
        contractBalance: ethers.formatEther(contractBalance),
        lastPriceUpdate: Date.now()
      });

      // Add both ETH and USDC price update events
      addEvent({
        type: 'price_update',
        message: `ETH: $${(Number(ethPriceData[0]) / 1e8).toFixed(2)} | USDC: $${(Number(usdcPriceData[0]) / 1e8).toFixed(4)}`,
        severity: 'info'
      });

    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  }, [publicClient, chainId, addEvent, getContractAddresses]);

  const checkUserMarginStatus = useCallback(async () => {
    const { hookAddress } = getContractAddresses();
    if (!publicClient || !address || !hookAddress) return;

    try {
      // REAL CHECK: Get policy status directly from contract
      const policyStatus = await publicClient.readContract({
        address: hookAddress as `0x${string}`,
        abi: MARGIN_CALL_HOOK_ABI,
        functionName: 'getPolicyStatus',
        args: [address]
      });

      const [active, ratio, , , lastCheck] = policyStatus as readonly [boolean, bigint, bigint, bigint, bigint, `0x${string}`];
      
      if (active) {
        const ratioNumber = Number(ratio);
        
        // REAL STATUS CALCULATION based on contract logic
        let status = '';
        let color = 'gray';
        
        if (ratioNumber === 0 || ratioNumber > 1000000) {
          status = 'No Data';
          color = 'gray';
        } else if (ratioNumber > 15000) {
          status = 'Very Safe';
          color = 'green';
        } else if (ratioNumber > 12000) {
          status = 'Safe';
          color = 'green';
        } else if (ratioNumber > 11000) {
          status = 'Warning';
          color = 'yellow';
        } else {
          status = 'Danger';
          color = 'red';
          
          // Add margin call event
          addEvent({
            type: 'margin_check',
            message: `Margin call detected: ${(ratioNumber / 100).toFixed(1)}%`,
            severity: 'danger'
          });
        }

        setUserMarginStatus({
          ratio: ratioNumber,
          status,
          color
        });

        // Add monitoring event
        if (ratioNumber <= 12000) {
          addEvent({
            type: 'margin_check',
            message: `Position monitored: ${(ratioNumber / 100).toFixed(1)}%`,
            severity: ratioNumber <= 11000 ? 'warning' : 'info'
          });
        }
      } else {
        setUserMarginStatus(null);
      }

    } catch (error) {
      console.error('Failed to check margin status:', error);
    }
  }, [publicClient, address, chainId, addEvent, getContractAddresses]);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadSystemStatus(),
        checkUserMarginStatus()
      ]);
    } catch (error) {
      console.error('Failed to load monitor data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadSystemStatus, checkUserMarginStatus]);

  const refreshData = async () => {
    await loadAllData();
    addEvent({
      type: 'price_update',
      message: 'Manual refresh completed',
      severity: 'info'
    });
  };

  // Auto-generate background TxIDs on component mount and periodically
  useEffect(() => {
    if (publicClient) {
      loadAllData();
      
      // Set up periodic refresh every 30 seconds
      const refreshInterval = setInterval(loadAllData, 30000);
      
      // Set up periodic background TxID generation every 60 seconds
      const txInterval = setInterval(() => {
        generateBackgroundTxIDs();
      }, 60000);
      
      // Generate first background TxID after 10 seconds
      const initialTxTimeout = setTimeout(() => {
        generateBackgroundTxIDs();
      }, 10000);

      return () => {
        clearInterval(refreshInterval);
        clearInterval(txInterval);
        clearTimeout(initialTxTimeout);
      };
    }
  }, [publicClient, loadAllData, generateBackgroundTxIDs]);

  // Info Popup Components
  const InsurancePoolInfo = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Insurance Pool</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p>• Funds collected from insurance premiums</p>
          <p>• Used for automatic payouts during margin calls</p>
          <p>• Payouts trigger when position falls below 110% collateralization</p>
          <p>• Covers up to 80% of your collateral value</p>
          <p>• Pool must be funded to provide coverage</p>
        </div>
        <button 
          onClick={() => setShowInsurancePoolInfo(false)}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium"
        >
          Got it
        </button>
      </div>
    </div>
  );

  const PositionStatusInfo = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Position Status</h3>
        <div className="text-sm text-gray-700 space-y-3">
          <div className="flex items-start">
            <div className="w-3 h-3 bg-green-500 rounded-full mt-1 mr-2 flex-shrink-0"></div>
            <div>
              <strong>Safe (&gt;120%):</strong> Position well above margin threshold
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mt-1 mr-2 flex-shrink-0"></div>
            <div>
              <strong>Warning (110-120%):</strong> Approaching margin call threshold
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-3 h-3 bg-red-500 rounded-full mt-1 mr-2 flex-shrink-0"></div>
            <div>
              <strong>Danger (&lt;110%):</strong> Auto-payout triggers immediately
            </div>
          </div>
          <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mt-2">
            <p className="text-xs text-yellow-800">
              <strong>Auto-payout:</strong> When collateralization falls below 110%, 
              the contract automatically pays 80% of your collateral value from the insurance pool.
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowPositionStatusInfo(false)}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium"
        >
          Got it
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 text-sm">Starting monitor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Popups */}
      {showInsurancePoolInfo && <InsurancePoolInfo />}
      {showPositionStatusInfo && <PositionStatusInfo />}

      {/* System Status */}
      <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">System Monitor</h2>
          <button
            onClick={refreshData}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors flex items-center gap-1"
          >
            <span>🔄</span>
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center relative">
            <div className="text-2xl mb-1">🛡️</div>
            <div className="text-sm font-bold text-green-600">{systemStatus.totalPolicies}</div>
            <div className="text-xs text-green-700">Active Policies</div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center relative">
            <button 
              onClick={() => setShowInsurancePoolInfo(true)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ℹ️
            </button>
            <div className="text-2xl mb-1">💰</div>
            <div className="text-sm font-bold text-blue-600">
              {parseFloat(systemStatus.contractBalance).toFixed(4)} ETH
            </div>
            <div className="text-xs text-blue-700">Insurance Pool</div>
          </div>
        </div>

        {/* User Margin Status */}
        {userMarginStatus && (
          <div className={`border-2 rounded-lg p-3 text-center relative ${
            userMarginStatus.color === 'green' ? 'bg-green-50 border-green-300' :
            userMarginStatus.color === 'yellow' ? 'bg-yellow-50 border-yellow-300' :
            userMarginStatus.color === 'red' ? 'bg-red-50 border-red-300' :
            'bg-gray-50 border-gray-300'
          }`}>
            <button 
              onClick={() => setShowPositionStatusInfo(true)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ℹ️
            </button>
            <div className="text-lg mb-1">
              {userMarginStatus.color === 'green' ? '🟢' :
               userMarginStatus.color === 'yellow' ? '🟡' :
               userMarginStatus.color === 'red' ? '🔴' : '⚪'}
            </div>
            <div className={`text-sm font-bold ${
              userMarginStatus.color === 'green' ? 'text-green-600' :
              userMarginStatus.color === 'yellow' ? 'text-yellow-600' :
              userMarginStatus.color === 'red' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {userMarginStatus.status}
            </div>
            <div className={`text-xs ${
              userMarginStatus.color === 'green' ? 'text-green-700' :
              userMarginStatus.color === 'yellow' ? 'text-yellow-700' :
              userMarginStatus.color === 'red' ? 'text-red-700' :
              'text-gray-700'
            }`}>
              {userMarginStatus.ratio > 0 && userMarginStatus.ratio < 1000000 
                ? `${(userMarginStatus.ratio / 100).toFixed(1)}% collateralized`
                : 'No active policy'
              }
            </div>
          </div>
        )}
      </div>

      {/* Live Events Feed */}
      <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Live Events</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              No events yet. Monitoring system ready.
            </div>
          ) : (
            events.map((event, index) => (
              <div key={index} className={`flex items-start gap-2 p-2 rounded border-l-4 ${
                event.severity === 'danger' ? 'border-l-red-500 bg-red-50' :
                event.severity === 'warning' ? 'border-l-yellow-500 bg-yellow-50' :
                'border-l-blue-500 bg-blue-50'
              }`}>
                <div className="flex-shrink-0 mt-0.5">
                  {event.severity === 'danger' ? '🔴' :
                   event.severity === 'warning' ? '🟡' : '🔵'}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-900">{event.message}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
        <div className="flex items-start gap-3">
          <div className="text-xl">⚡</div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-purple-900 mb-1">
              Real-time Monitoring Active
            </h3>
            <p className="text-purple-700 text-xs">
              Monitoring {systemStatus.totalPolicies} active policies • 
              Pyth oracle updates every 30s • 
              Auto-detects margin calls •
              Auto-generates TxIDs every 60s
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}