//components/InsuranceDashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useChainId, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { getChainConfig, PYTH_FEED_IDS } from '../lib/chain-config';
import { pythService } from '../lib/pyth-service';

interface InsurancePurchase {
  id: string;
  timestamp: number;
  collateralAmount: string;
  debtAmount: string;
  premium: string;
  coverage: string;
  transactionHash?: string;
  status: 'active' | 'expired';
  explorerUrl?: string; // NEW: Added explorer URL for persistence
}

interface TransactionStatus {
  type: 'success' | 'error' | 'pending' | 'info' | null;
  message: string;
  hash?: string;
  // Remove explorerUrl from here since we don't need it in TransactionStatus
}

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
    "name": "purchaseInsurance",
    "inputs": [
      {"name": "collateralAmount", "type": "uint256"},
      {"name": "collateralFeedId", "type": "bytes32"},
      {"name": "debtAmount", "type": "uint256"},
      {"name": "debtFeedId", "type": "bytes32"},
      {"name": "priceUpdateData", "type": "bytes[]"}
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "updatePriceFeeds",
    "inputs": [{"name": "priceUpdateData", "type": "bytes[]"}],
    "outputs": [],
    "stateMutability": "payable"
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
    "name": "checkMarginCallStatus",
    "inputs": [{"name": "user", "type": "address"}],
    "outputs": [
      {"name": "reason", "type": "string"},
      {"name": "isDangerous", "type": "bool"}
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelInsurance",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
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
    "name": "getUSDCBalance",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  }
] as const;

// Storage keys - UPDATED for persistence
const STORAGE_KEYS = {
  INSURANCE_PURCHASES: 'insurance_purchases_persistent',
  WALLET_ADDRESS: 'insurance_wallet_address'
};

// Get explorer URL function
const getExplorerUrl = (chainId: number, hash: string): string => {
  const baseUrls: Record<number, string> = {
    11155111: 'https://sepolia.etherscan.io/tx',
    84532: 'https://sepolia.basescan.org/tx',
    1: 'https://etherscan.io/tx',
    8453: 'https://basescan.org/tx'
  };
  
  const baseUrl = baseUrls[chainId] || 'https://etherscan.io/tx';
  return `${baseUrl}/${hash}`;
};

// Get purchases from localStorage with wallet and chain scoping
const getStoredPurchases = (address: string, chainId: number): InsurancePurchase[] => {
  if (typeof window === 'undefined') return [];
  try {
    const storageKey = `${STORAGE_KEYS.INSURANCE_PURCHASES}_${address?.toLowerCase()}_${chainId}`;
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save purchases to localStorage with wallet and chain scoping
const savePurchases = (purchases: InsurancePurchase[], address: string, chainId: number) => {
  if (typeof window === 'undefined') return;
  try {
    const storageKey = `${STORAGE_KEYS.INSURANCE_PURCHASES}_${address?.toLowerCase()}_${chainId}`;
    localStorage.setItem(storageKey, JSON.stringify(purchases));
  } catch (error) {
    console.error('Failed to save purchases:', error);
  }
};

// Clear purchases when wallet disconnects
const clearPersistedPurchases = (address: string) => {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear for all possible chains
    const chains = [11155111, 84532, 1, 8453];
    chains.forEach(chainId => {
      const storageKey = `${STORAGE_KEYS.INSURANCE_PURCHASES}_${address?.toLowerCase()}_${chainId}`;
      localStorage.removeItem(storageKey);
    });
  } catch (error) {
    console.error('Failed to clear persisted purchases:', error);
  }
};

export default function ImprovedDashboard() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  
  const [collateralAmount, setCollateralAmount] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [premium, setPremium] = useState('');
  const [coverage, setCoverage] = useState('');
  const [purchases, setPurchases] = useState<InsurancePurchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contractBalance, setContractBalance] = useState('0');
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>({ type: null, message: '' });
  const [walletBalance, setWalletBalance] = useState<string>('');
  const [priceUpdateData, setPriceUpdateData] = useState<`0x${string}`[]>([]);
  const [pythFee, setPythFee] = useState<bigint>(BigInt(0));
  const [currentPrices, setCurrentPrices] = useState<{ ethPrice: number; usdcPrice: number } | null>(null);
  const [hasActivePolicy, setHasActivePolicy] = useState<boolean>(false);

  const chainConfig = getChainConfig(chainId);

  // Load purchases from localStorage on mount
  useEffect(() => {
    if (address) {
      const storedPurchases = getStoredPurchases(address, chainId);
      setPurchases(storedPurchases);
    }
  }, [address, chainId]);

  // Save purchases when they change
  useEffect(() => {
    if (address) {
      savePurchases(purchases, address, chainId);
    }
  }, [purchases, address, chainId]);

  // Clear data when wallet disconnects
  useEffect(() => {
    if (!address) {
      setPurchases([]);
      clearPersistedPurchases(address || '');
    }
  }, [address]);

  const showTransactionStatus = useCallback((type: 'success' | 'error' | 'pending' | 'info', message: string, hash?: string) => {
    // FIXED: Remove explorerUrl from setTransactionStatus since it's not in the interface
    setTransactionStatus({ type, message, hash });
    
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        setTransactionStatus(prev => prev.type === type ? { type: null, message: '' } : prev);
      }, 10000);
    }
  }, []);

  // Get current prices from Pyth
  const getCurrentPrices = useCallback(async (): Promise<{ ethPrice: number; usdcPrice: number }> => {
    try {
      let ethPrice = 0;
      let usdcPrice = 0;
      
      try {
        const prices = await pythService.getLatestPrices([
          PYTH_FEED_IDS.ETH_USD,
          PYTH_FEED_IDS.USDC_USD
        ]);
        
        if (prices && typeof prices === 'object') {
          const priceValues = Object.values(prices);
          
          const ethPriceObj = priceValues.find((p: any) => p.price > 1000 && p.price < 10000);
          const usdcPriceObj = priceValues.find((p: any) => p.price > 0.9 && p.price < 1.1);
          
          if (ethPriceObj) ethPrice = ethPriceObj.price;
          if (usdcPriceObj) usdcPrice = usdcPriceObj.price;
        }
        
      } catch (pythError) {
        console.error('Pyth service failed:', pythError);
      }

      if (ethPrice === 0 || usdcPrice === 0) {
        ethPrice = 2500;
        usdcPrice = 1;
      }

      setCurrentPrices({ ethPrice, usdcPrice });
      return { ethPrice, usdcPrice };
      
    } catch (error: any) {
      console.error('Price fetch failed:', error.message);
      const fallbackPrices = { ethPrice: 2500, usdcPrice: 1 };
      setCurrentPrices(fallbackPrices);
      return fallbackPrices;
    }
  }, []);

  // Load wallet balance
  const loadWalletBalance = useCallback(async () => {
    if (!publicClient || !address) {
      setWalletBalance('0');
      return;
    }
    
    try {
      const balance = await publicClient.getBalance({ address });
      const formattedBalance = ethers.formatEther(balance);
      setWalletBalance(formattedBalance);
    } catch (error) {
      console.error('Failed to load wallet balance:', error);
      setWalletBalance('0');
    }
  }, [publicClient, address]);

  // Load contract balance
  const loadContractBalance = useCallback(async () => {
    if (!publicClient || !chainConfig?.hookAddress) return;

    try {
      const balance = await publicClient.getBalance({
        address: chainConfig.hookAddress
      });
      setContractBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error('Failed to load contract balance:', error);
      setContractBalance('0');
    }
  }, [publicClient, chainConfig]);

  // Fetch price update data
  const fetchPriceUpdateData = useCallback(async () => {
    try {
      const feedIds = [PYTH_FEED_IDS.ETH_USD, PYTH_FEED_IDS.USDC_USD];
      
      const updateData = await pythService.getPriceUpdateData(feedIds);
      
      if (!updateData || updateData.length === 0 || !updateData[0] || updateData[0] === '0x') {
        throw new Error('Invalid price update data');
      }
      
      setPriceUpdateData(updateData as `0x${string}`[]);
      
      const fee = await pythService.getUpdateFee(feedIds);
      setPythFee(fee);
      
    } catch (error: any) {
      console.error('Failed to fetch price update data:', error);
      showTransactionStatus('error', 'Failed to fetch price data');
      throw error;
    }
  }, [showTransactionStatus]);

  const loadContractPolicyDetails = useCallback(async () => {
    if (!publicClient || !chainConfig?.hookAddress || !address) return null;

    try {
      const policy = await publicClient.readContract({
        address: chainConfig.hookAddress,
        abi: MARGIN_CALL_HOOK_ABI,
        functionName: 'policies',
        args: [address]
      });

      if (policy[8]) {
        return {
          collateralAmount: ethers.formatEther(policy[1]),
          debtAmount: ethers.formatEther(policy[3]),
          premiumPaid: ethers.formatEther(policy[6]),
          coverageAmount: ethers.formatEther(policy[7]),
          startTime: Number(policy[9]) * 1000,
          active: policy[8],
          transactionHash: '' // Add empty transaction hash since we can't get it from contract state
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to load contract policy details:', error);
      return null;
    }
  }, [publicClient, chainConfig, address]);

  // Check for existing policy - UPDATED to sync with contract
  const checkExistingPolicy = useCallback(async (): Promise<boolean> => {
    if (!publicClient || !chainConfig?.hookAddress || !address) return false;
    
    try {
      const policy = await publicClient.readContract({
        address: chainConfig.hookAddress,
        abi: MARGIN_CALL_HOOK_ABI,
        functionName: 'policies',
        args: [address]
      });
      
      const isActive = policy[8];
      setHasActivePolicy(isActive);
      
      // Sync with purchases - if contract says active but purchases don't show it
      if (isActive) {
        const activeInPurchases = purchases.some(p => p.status === 'active');
        if (!activeInPurchases) {
          // Load policy details directly instead of calling refreshData
          const policyDetails = await loadContractPolicyDetails();
          if (policyDetails && policyDetails.active) {
            const syntheticPurchase: InsurancePurchase = {
              id: `contract-${Date.now()}`, // Always use synthetic ID for contract-loaded policies
              timestamp: policyDetails.startTime,
              collateralAmount: policyDetails.collateralAmount,
              debtAmount: policyDetails.debtAmount,
              premium: policyDetails.premiumPaid,
              coverage: policyDetails.coverageAmount,
              transactionHash: '', // No transaction hash available for contract-loaded policies
              status: 'active'
            };

            setPurchases(prev => {
              const filtered = prev.filter(p => !p.id.startsWith('contract-'));
              return [...filtered, syntheticPurchase];
            });
          }
        }
      }
      
      return isActive;
    } catch (error) {
      console.log('Failed to check existing policy:', error);
      return false;
    }
  }, [publicClient, chainConfig, address, purchases, loadContractPolicyDetails]);

  const formatEthAmount = (amount: string): string => {
    try {
      const num = parseFloat(amount);
      if (isNaN(num)) return amount;
      
      if (num >= 1) {
        return num.toFixed(4); // For amounts >= 1 ETH, show 4 decimals
      } else if (num >= 0.001) {
        return num.toFixed(6); // For amounts >= 0.001 ETH, show 6 decimals
      } else if (num >= 0.000001) {
        return num.toFixed(8); // For very small amounts, show 8 decimals
      } else {
        return num.toFixed(10); // For extremely small amounts
      }
    } catch {
      return amount;
    }
  };

  const formatUsdcAmount = (amount: string): string => {
    try {
      const num = parseFloat(amount);
      if (isNaN(num)) return amount;
      
      if (num >= 1) {
        return num.toFixed(2); // For USDC, show 2 decimals for whole numbers
      } else {
        return num.toFixed(4); // For fractional USDC, show 4 decimals
      }
    } catch {
      return amount;
    }
  };

  // Calculate premium
  const calculatePremium = useCallback(() => {
    if (!collateralAmount || !debtAmount || !currentPrices) {
      setPremium('');
      setCoverage('');
      return;
    }
    
    try {
      const collateralNum = parseFloat(collateralAmount);
      const debtNum = parseFloat(debtAmount);
      
      if (debtNum === 0) return;

      const { ethPrice, usdcPrice } = currentPrices;
      
      // Convert user input to wei
      const collateralWei = parseFloat(collateralAmount) * 1e18;
      const debtWei = parseFloat(debtAmount) * 1e18;
      
      // Convert prices to scaled format
      const collateralPriceScaled = ethPrice * 1e8;
      const debtPriceScaled = usdcPrice * 1e8;
      
      // Calculate USD values as contract does
      const collateralValueUSD = (collateralWei * collateralPriceScaled) / 1e18;
      const debtValueUSD = (debtWei * debtPriceScaled) / 1e18;
      
      if (debtValueUSD === 0) return;
      
      const PREMIUM_BASE = 10000;
      const collateralizationRatio = (collateralValueUSD * PREMIUM_BASE) / debtValueUSD;
      
      // Premium calculation as in contract
      const basePremiumUSD = (collateralValueUSD * 200) / PREMIUM_BASE;
      const riskFactor = (PREMIUM_BASE * PREMIUM_BASE) / collateralizationRatio;
      const riskPremiumUSD = (basePremiumUSD * riskFactor) / PREMIUM_BASE;
      const totalPremiumUSD = basePremiumUSD + riskPremiumUSD;
      
      // Convert premium back to ETH
      const premiumInWei = (totalPremiumUSD * 1e18) / collateralPriceScaled;
      const premiumInEth = premiumInWei / 1e18;
      
      // Coverage calculation
      const COVERAGE_RATIO = 8000;
      const coverageUSD = (collateralValueUSD * COVERAGE_RATIO) / PREMIUM_BASE;
      const coverageInWei = (coverageUSD * 1e18) / collateralPriceScaled;
      const coverageInEth = coverageInWei / 1e18;
      
      // Format with reasonable decimal places
      setPremium(formatEthAmount(premiumInEth.toString()));
      setCoverage(formatEthAmount(coverageInEth.toString()));
      
    } catch (error) {
      console.error('Premium calculation failed:', error);
      setPremium('');
      setCoverage('');
    }
  }, [collateralAmount, debtAmount, currentPrices]);

  // Check contract funding
  const checkContractFunding = useCallback(async (): Promise<boolean> => {
    if (!publicClient || !chainConfig?.hookAddress) return false;

    try {
      const contractBalance = await publicClient.getBalance({
        address: chainConfig.hookAddress
      });

      // Contract needs at least 0.01 ETH to operate
      const hasSufficientFunds = contractBalance > ethers.parseEther("0.01");
      
      if (!hasSufficientFunds) {
        console.error('Contract has insufficient funds:', ethers.formatEther(contractBalance));
      }
      
      return hasSufficientFunds;
    } catch (error) {
      console.error('Contract funding check failed:', error);
      return false;
    }
  }, [publicClient, chainConfig]);

  // Fund contract function
  const fundContract = useCallback(async (amount: string) => {
    if (!walletClient || !chainConfig?.hookAddress || !publicClient) return;

    try {
      console.log('Funding contract with:', amount, 'ETH');
      showTransactionStatus('pending', 'Funding contract...');
      
      const txHash = await walletClient.sendTransaction({
        to: chainConfig.hookAddress,
        value: ethers.parseEther(amount)
      });
      
      showTransactionStatus('pending', 'Confirming contract funding...', txHash);
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        confirmations: 1
      });
      
      if (receipt.status === 'success') {
        showTransactionStatus('success', 'Contract funded successfully!', txHash);
        await loadContractBalance();
      } else {
        throw new Error('Funding transaction reverted');
      }
      
    } catch (error: any) {
      console.error('Contract funding failed:', error);
      showTransactionStatus('error', `Funding failed: ${error.message}`);
    }
  }, [walletClient, publicClient, chainConfig, showTransactionStatus, loadContractBalance]);

  // Cancel insurance function
  const cancelInsurance = useCallback(async () => {
    if (!walletClient || !chainConfig?.hookAddress || !publicClient) return;

    setIsLoading(true);
    
    try {
      showTransactionStatus('pending', 'Cancelling insurance policy...');
      
      const txHash = await walletClient.writeContract({
        address: chainConfig.hookAddress,
        abi: MARGIN_CALL_HOOK_ABI,
        functionName: 'cancelInsurance',
        args: [],
        gas: BigInt(300000)
      });

      showTransactionStatus('pending', 'Confirming cancellation...', txHash);
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        confirmations: 1
      });
      
      if (receipt.status === 'success') {
        showTransactionStatus('success', 'Insurance cancelled!', txHash);
        
        // Update purchases state to mark as expired
        setPurchases(prev => prev.map(p => 
          p.status === 'active' ? { ...p, status: 'expired' } : p
        ));
        
        setHasActivePolicy(false);
        await loadContractBalance();
        await loadWalletBalance();
      } else {
        throw new Error('Cancellation reverted');
      }
      
    } catch (error: any) {
      console.error('Insurance cancellation failed:', error);
      
      if (error.message?.includes('user rejected')) {
        showTransactionStatus('error', 'Cancellation cancelled');
      } else if (error.message?.includes('No active policy')) {
        showTransactionStatus('error', 'No active policy to cancel');
      } else {
        showTransactionStatus('error', `Cancellation failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, publicClient, chainConfig, showTransactionStatus, loadContractBalance, loadWalletBalance]);

  // Main purchase insurance function
  const handlePurchaseInsurance = useCallback(async () => {
    if (!walletClient || !publicClient || !chainConfig?.hookAddress || !collateralAmount || !debtAmount || !currentPrices) {
      showTransactionStatus('error', 'Please check inputs and connection');
      return;
    }

    setIsLoading(true);

    try {
      const collateralNum = parseFloat(collateralAmount);
      const debtNum = parseFloat(debtAmount);
      
      if (collateralNum <= 0 || debtNum <= 0) {
        throw new Error('Invalid collateral or debt amount');
      }

      // Check for existing policy
      const hasActivePolicy = await checkExistingPolicy();
      if (hasActivePolicy) {
        throw new Error('You already have an active insurance policy');
      }

      // Check contract funding
      const contractHasFunds = await checkContractFunding();
      if (!contractHasFunds) {
        throw new Error('Insurance contract has insufficient funds. Please fund the contract first.');
      }

      // STEP 1: Get FRESH price update data
      showTransactionStatus('info', 'Getting fresh price data from Pyth...');
      
      const feedIds = [PYTH_FEED_IDS.ETH_USD, PYTH_FEED_IDS.USDC_USD];
      const freshPriceUpdateData = await pythService.getPriceUpdateData(feedIds);
      
      if (!freshPriceUpdateData || freshPriceUpdateData.length === 0 || !freshPriceUpdateData[0] || freshPriceUpdateData[0] === '0x') {
        throw new Error('Failed to get fresh price data');
      }
      
      const freshPythFee = await pythService.getUpdateFee(feedIds);

      // STEP 2: Calculate premium and values
      const { ethPrice, usdcPrice } = currentPrices;
      
      const collateralAmountWei = ethers.parseEther(collateralAmount);
      const debtAmountWei = ethers.parseEther(debtAmount);
      
      // Convert prices to scaled format
      const collateralPriceScaled = ethPrice * 1e8;
      const debtPriceScaled = usdcPrice * 1e8;
      
      // Calculate values as contract does
      const collateralValueUSD = (Number(collateralAmountWei) * collateralPriceScaled) / 1e18;
      const debtValueUSD = (Number(debtAmountWei) * debtPriceScaled) / 1e18;
      
      if (debtValueUSD === 0) {
        throw new Error('Debt value too small');
      }

      const PREMIUM_BASE = 10000;
      const collateralizationRatio = (collateralValueUSD * PREMIUM_BASE) / debtValueUSD;
      
      if (collateralizationRatio < 11000) {
        showTransactionStatus('error', `Position would be under margin (${(collateralizationRatio / 100).toFixed(1)}% < 110%). Increase collateral or reduce debt.`);
        return;
      }

      // Calculate premium
      const basePremiumUSD = (collateralValueUSD * 200) / PREMIUM_BASE;
      const riskFactor = (PREMIUM_BASE * PREMIUM_BASE) / collateralizationRatio;
      const riskPremiumUSD = (basePremiumUSD * riskFactor) / PREMIUM_BASE;
      const totalPremiumUSD = basePremiumUSD + riskPremiumUSD;
      
      // Convert premium to ETH
      const premiumInWei = BigInt(Math.floor((totalPremiumUSD * 1e18) / collateralPriceScaled));
      
      // Add buffer to Pyth fee for safety
      const feeBuffer = freshPythFee / BigInt(10);
      const totalValue = premiumInWei + freshPythFee + feeBuffer;

      // Check user balance
      const userBalance = await publicClient.getBalance({ address: address! });
      if (userBalance < totalValue) {
        throw new Error(`Insufficient ETH balance. Need ${ethers.formatEther(totalValue)} ETH but have ${ethers.formatEther(userBalance)} ETH`);
      }

      // STEP 3: Send transaction
      showTransactionStatus('pending', 'Purchasing insurance...');
      
      const purchaseHash = await walletClient.writeContract({
        address: chainConfig.hookAddress,
        abi: MARGIN_CALL_HOOK_ABI,
        functionName: 'purchaseInsurance',
        args: [
          collateralAmountWei,
          PYTH_FEED_IDS.ETH_USD,
          debtAmountWei,
          PYTH_FEED_IDS.USDC_USD,
          freshPriceUpdateData as `0x${string}`[]
        ],
        value: totalValue,
        gas: BigInt(800000)
      });

      showTransactionStatus('pending', 'Confirming insurance purchase...', purchaseHash);
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: purchaseHash,
        confirmations: 1,
        timeout: 120000
      });

      if (receipt.status === 'success') {
        // Create new purchase with explorer URL
        const newPurchase: InsurancePurchase = {
          id: purchaseHash,
          timestamp: Date.now(),
          collateralAmount,
          debtAmount,
          premium: formatEthAmount(ethers.formatEther(premiumInWei)),
          coverage: formatEthAmount(coverage || '0'),
          transactionHash: purchaseHash,
          explorerUrl: getExplorerUrl(chainId, purchaseHash), // NEW: Store explorer URL
          status: 'active'
        };

        // Update purchases with persistence
        const updatedPurchases = [...purchases, newPurchase];
        setPurchases(updatedPurchases);
        
        setHasActivePolicy(true);
        showTransactionStatus('success', 'Insurance purchased!', purchaseHash);
        
        setCollateralAmount('');
        setDebtAmount('');
        setPremium('');
        setCoverage('');
        
        await Promise.all([loadContractBalance(), loadWalletBalance()]);
        
      } else {
        throw new Error('Transaction reverted on-chain');
      }
      
    } catch (error: any) {
      console.error('Insurance purchase failed:', error);
      
      if (error.message?.includes('user rejected')) {
        showTransactionStatus('error', 'Transaction cancelled');
      } else if (error.message?.includes('insufficient funds')) {
        showTransactionStatus('error', 'Insufficient ETH balance');
      } else if (error.message?.includes('already have an active insurance policy')) {
        showTransactionStatus('error', 'You already have an active insurance policy');
      } else if (error.message?.includes('under margin')) {
        showTransactionStatus('error', error.message);
      } else if (error.message?.includes('Insurance contract has insufficient funds')) {
        showTransactionStatus('error', error.message);
      } else {
        showTransactionStatus('error', `Purchase failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    walletClient, publicClient, chainConfig, collateralAmount, debtAmount,
    premium, coverage, showTransactionStatus, address, loadContractBalance, 
    loadWalletBalance, currentPrices, checkExistingPolicy, checkContractFunding,
    purchases, chainId
  ]);

  // Manual refresh function
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await Promise.all([
        loadWalletBalance(),
        fetchPriceUpdateData(),
        loadContractBalance(),
        getCurrentPrices(),
        checkExistingPolicy() // This will handle the policy sync
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    loadWalletBalance, fetchPriceUpdateData, loadContractBalance, 
    getCurrentPrices, checkExistingPolicy
  ]);

  // Load initial data on mount
  useEffect(() => {
    if (!address || !publicClient || !walletClient) return;
    
    const initializeData = async () => {
      setIsLoading(true);
      try {
        // First load from localStorage (persistent)
        const storedPurchases = getStoredPurchases(address, chainId);
        setPurchases(storedPurchases);
        
        // Then check contract state and sync
        const [walletBal, , contractBal, prices, hasActive] = await Promise.all([
          loadWalletBalance(),
          fetchPriceUpdateData(),
          loadContractBalance(),
          getCurrentPrices(),
          checkExistingPolicy()
        ]);
        
        // If contract says we have active policy but localStorage doesn't show it,
        // and we don't have any active purchases in storage, create a placeholder
        if (hasActive && !storedPurchases.some(p => p.status === 'active')) {
          const policyDetails = await loadContractPolicyDetails();
          if (policyDetails) {
            const placeholderPurchase: InsurancePurchase = {
              id: `placeholder-${Date.now()}`,
              timestamp: policyDetails.startTime,
              collateralAmount: formatEthAmount(policyDetails.collateralAmount),
              debtAmount: formatUsdcAmount(policyDetails.debtAmount),
              premium: formatEthAmount(policyDetails.premiumPaid),
              coverage: formatEthAmount(policyDetails.coverageAmount),
              transactionHash: '', // No transaction hash available
              status: 'active'
            };
            
            const updatedPurchases = [...storedPurchases, placeholderPurchase];
            setPurchases(updatedPurchases);
          }
        }
      } catch (error) {
        console.error('Initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, [address, publicClient, walletClient, chainId]);

  // Calculate premium when amounts or prices change
  useEffect(() => {
    calculatePremium();
  }, [calculatePremium]);

  // Get logical status based on purchases
  const getCurrentStatus = () => {
    const activePurchases = purchases.filter(p => p.status === 'active');
    
    if (activePurchases.length === 0 && !hasActivePolicy) {
      return { status: 'No Active Policy', color: 'gray', icon: '❓' };
    }

    return { status: 'Protected', color: 'green', icon: '🛡️' };
  };

  const currentStatus = getCurrentStatus();
  const activePurchases = purchases.filter(p => p.status === 'active');

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
        <div className="text-center py-4">
          <div className="text-2xl mb-2">🔐</div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Connect Your Wallet</h3>
          <p className="text-gray-600 text-xs">Connect to purchase margin protection</p>
        </div>
      </div>
    );
  }

  const canPurchase = Boolean(
    premium && 
    walletClient && 
    collateralAmount && 
    debtAmount &&
    currentPrices &&
    parseFloat(collateralAmount) > 0 &&
    parseFloat(debtAmount) > 0 &&
    parseFloat(premium) > 0
  );

  const [showPolicies, setShowPolicies] = useState(true);

  return (
    <div className="space-y-4">
      {/* Transaction Status */}
      {transactionStatus.type && (
        <div className={`p-3 rounded-lg ${
          transactionStatus.type === 'success' ? 'bg-green-50 border border-green-200' :
          transactionStatus.type === 'error' ? 'bg-red-50 border border-red-200' :
          transactionStatus.type === 'pending' ? 'bg-blue-50 border border-blue-200' :
          'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`flex-shrink-0 ${
              transactionStatus.type === 'success' ? 'text-green-400' :
              transactionStatus.type === 'error' ? 'text-red-400' :
              transactionStatus.type === 'pending' ? 'text-blue-400 animate-spin' :
              'text-yellow-400'
            }`}>
              {transactionStatus.type === 'success' ? '✅' :
               transactionStatus.type === 'error' ? '❌' :
               transactionStatus.type === 'pending' ? '⏳' : 'ℹ️'}
            </div>
            <div className="flex-1">
              <div className={`text-sm ${
                transactionStatus.type === 'success' ? 'text-green-800' :
                transactionStatus.type === 'error' ? 'text-red-800' :
                transactionStatus.type === 'pending' ? 'text-blue-800' :
                'text-yellow-800'
              }`}>
                {transactionStatus.message}
              </div>
              {transactionStatus.hash && (
                <div className="mt-1">
                  <a 
                    href={getExplorerUrl(chainId, transactionStatus.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    View on Explorer ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contract Funding Alert */}
      {contractBalance === '0' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">Contract Needs Funding</h3>
              <p className="text-yellow-700 text-xs">
                The insurance contract has 0 ETH balance and cannot provide coverage.
              </p>
            </div>
            <button
              onClick={() => fundContract('0.1')}
              disabled={isLoading}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:cursor-not-allowed"
            >
              Fund with 0.1 ETH
            </button>
          </div>
        </div>
      )}

      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Insurance Dashboard</h1>
        <button
          onClick={refreshData}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
        >
          {isLoading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Current Prices Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex justify-between items-center">
          <div className="text-sm font-medium text-blue-800">Current Prices</div>
          <div className="text-xs text-blue-600">Live from Pyth</div>
        </div>
        {currentPrices ? (
          <div className="grid grid-cols-2 gap-2 mt-2 text-center">
            <div className="bg-white rounded p-2 border border-blue-100">
              <div className="text-xs text-gray-600">ETH Price</div>
              <div className="text-sm font-bold text-blue-600">${currentPrices.ethPrice.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded p-2 border border-blue-100">
              <div className="text-xs text-gray-600">USDC Price</div>
              <div className="text-sm font-bold text-blue-600">${currentPrices.usdcPrice.toFixed(4)}</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="text-xs text-blue-700">Loading prices...</div>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg shadow p-3 border border-gray-100 text-center">
         <div className="text-lg font-bold text-blue-600">{formatEthAmount(contractBalance)} ETH</div>
          <div className="text-xs text-gray-600">Insurance Pool</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-3 border border-gray-100 text-center">
          <div className={`text-lg font-bold ${
            currentStatus.color === 'green' ? 'text-green-600' :
            currentStatus.color === 'red' ? 'text-red-600' :
            'text-gray-600'
          }`}>
            {currentStatus.status}
          </div>
          <div className="text-xs text-gray-600">Your Status</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-3 border border-gray-100 text-center">
          <div className="text-lg font-bold text-purple-600">
            {walletBalance ? parseFloat(walletBalance).toFixed(4) : '0'} ETH
          </div>
          <div className="text-xs text-gray-600">Your Balance</div>
        </div>
      </div>

      {/* Your Insurance Policies - UPDATED with persistent View on Explorer links */}
      {(purchases.length > 0 || hasActivePolicy) && (
        <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
          <div 
            className="flex justify-between items-center cursor-pointer"
            onClick={() => setShowPolicies(!showPolicies)}
          >
            <h2 className="text-lg font-bold text-gray-900">
              Your Insurance Policies ({activePurchases.length} active)
            </h2>
            <div className="transform transition-transform duration-200">
              {showPolicies ? (
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </div>
          </div>
          
          {showPolicies && (
            <div className="space-y-3 max-h-60 overflow-y-auto mt-3">
              {purchases.map((purchase) => (
                <div key={purchase.id} className={`rounded-lg p-3 border ${
                  purchase.status === 'active' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        purchase.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {purchase.status === 'active' ? 'ACTIVE' : 'EXPIRED'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(purchase.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      {/* PERSISTENT: Show View on Explorer link if we have explorer URL */}
                      {purchase.explorerUrl && (
                        <a 
                          href={purchase.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          View on Explorer ↗
                        </a>
                      )}
                      {purchase.status === 'active' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the collapse
                            cancelInsurance();
                          }}
                          disabled={isLoading}
                          className="text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-1 px-2 rounded transition-colors disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-600">Collateral</div>
                      <div className="font-semibold">{formatEthAmount(purchase.collateralAmount)} ETH</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Debt</div>
                      <div className="font-semibold">{formatUsdcAmount(purchase.debtAmount)} USDC</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Premium Paid</div>
                      <div className="font-semibold">{formatEthAmount(purchase.premium)} ETH</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Coverage</div>
                      <div className="font-semibold">{formatEthAmount(purchase.coverage)} ETH</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Insurance Purchase Form */}
      <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Purchase Insurance Protection</h2>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Collateral (ETH)
              </label>
              <input
                type="number"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="0.1"
                step="0.001"
                min="0.001"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Debt (USDC)
              </label>
              <input
                type="number"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="350"
                step="0.1"
                min="1"
              />
            </div>
          </div>

          {premium && currentPrices && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-600">Premium</div>
                  <div className="text-lg font-bold text-blue-600">{premium} ETH</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Coverage</div>
                  <div className="text-lg font-bold text-green-600">{coverage} ETH</div>
                </div>
              </div>
              <div className="text-xs text-gray-600 text-center mt-2">
                Includes Pyth oracle fee: {ethers.formatEther(pythFee)} ETH
              </div>
            </div>
          )}

          {!currentPrices && (collateralAmount || debtAmount) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-xs text-yellow-700 text-center">
                Loading prices to calculate premium...
              </div>
            </div>
          )}

          <button
            onClick={handlePurchaseInsurance}
            disabled={!canPurchase || isLoading || contractBalance === '0' || hasActivePolicy}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
          >
            {hasActivePolicy ? 'You Have Active Policy' :
             contractBalance === '0' ? 'Contract Needs Funding' :
             isLoading ? 'Processing...' : 
             !canPurchase ? 'Enter Valid Amounts' : 
             `Purchase Protection - ${premium} ETH`}
          </button>
        </div>
      </div>
    </div>
  );
}