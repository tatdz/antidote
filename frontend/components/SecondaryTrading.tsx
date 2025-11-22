//components/SecondaryTrading.tsx
import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useChainId, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { getChainConfig } from '../lib/chain-config';
import { SECONDARY_MARKET_ABI, RISK_TOKEN_ABI } from '../lib/fixed-abis';

interface TransactionStatus {
  type: 'success' | 'error' | 'pending' | 'info' | null;
  message: string;
  hash?: string;
  explorerUrl?: string;
}

interface Order {
  orderId: number;
  user: string;
  tokenAmount: string;
  price: string;
  paymentToken: string;
  createdAt: number;
  active: boolean;
  totalPrice?: string;
}

interface InsuranceStatus {
  hasActivePolicy: boolean;
  collateralizationRatio: number;
  coverage: string;
  premium: string;
  paymentToken: string;
}

interface TradeHistory {
  type: 'buy' | 'sell' | 'buy-order' | 'sell-order';
  amount: string;
  price: string;
  totalValue: string;
  timestamp: number;
  hash: string;
  explorerUrl: string;
  status: 'created' | 'filled' | 'cancelled';
  chainId: number;
}

// Storage keys
const STORAGE_KEYS = {
  TRADE_HISTORY: 'secondary_market_trade_history',
  ACTIVE_ORDERS: 'secondary_market_active_orders',
  WALLET_ADDRESS: 'secondary_market_wallet_address'
};

// Base URLs for different chains
const BASE_URLS: Record<number, string> = {
  11155111: 'https://sepolia.etherscan.io/tx',
  84532: 'https://sepolia.basescan.org/tx',
  1: 'https://etherscan.io/tx',
  8453: 'https://basescan.org/tx'
};

export default function SecondaryTrading() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  
  // Separate state for buy and sell forms to prevent cross-contamination
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>({ type: null, message: '' });
  const [tokenBalance, setTokenBalance] = useState('0');
  const [tokenSymbol, setTokenSymbol] = useState('aRISK');
  const [activeSellOrders, setActiveSellOrders] = useState<Order[]>([]);
  const [activeBuyOrders, setActiveBuyOrders] = useState<Order[]>([]);
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [unrealizedPnL, setUnrealizedPnL] = useState(0);

  // Persistent storage functions
  const saveTradeHistory = useCallback((history: TradeHistory[]) => {
    if (!address) return;
    
    try {
      const storageKey = `${STORAGE_KEYS.TRADE_HISTORY}_${address.toLowerCase()}_${chainId}`;
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save trade history:', error);
    }
  }, [address, chainId]);

  const loadTradeHistory = useCallback((): TradeHistory[] => {
    if (!address) return [];
    
    try {
      const storageKey = `${STORAGE_KEYS.TRADE_HISTORY}_${address.toLowerCase()}_${chainId}`;
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load trade history:', error);
      return [];
    }
  }, [address, chainId]);

  const saveActiveOrders = useCallback((sellOrders: Order[], buyOrders: Order[]) => {
    if (!address) return;
    
    try {
      const storageKey = `${STORAGE_KEYS.ACTIVE_ORDERS}_${address.toLowerCase()}_${chainId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        sellOrders,
        buyOrders,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to save active orders:', error);
    }
  }, [address, chainId]);

  const loadActiveOrders = useCallback((): { sellOrders: Order[], buyOrders: Order[] } => {
    if (!address) return { sellOrders: [], buyOrders: [] };
    
    try {
      const storageKey = `${STORAGE_KEYS.ACTIVE_ORDERS}_${address.toLowerCase()}_${chainId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Only use cached data if it's less than 5 minutes old
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          return data;
        }
      }
    } catch (error) {
      console.error('Failed to load active orders:', error);
    }
    return { sellOrders: [], buyOrders: [] };
  }, [address, chainId]);

  const getSecondaryMarketAddress = useCallback((): `0x${string}` | null => {
    const config = getChainConfig(chainId);
    return config?.secondaryMarketAddress || null;
  }, [chainId]);

  const getRiskTokenAddress = useCallback((): `0x${string}` | null => {
    const config = getChainConfig(chainId);
    return config?.riskTokenAddress || null;
  }, [chainId]);

  const getExplorerUrl = useCallback((hash: string): string => {
    const baseUrl = BASE_URLS[chainId] || 'https://etherscan.io/tx';
    return `${baseUrl}/${hash}`;
  }, [chainId]);

  const showTransactionStatus = useCallback((type: 'success' | 'error' | 'pending' | 'info', message: string, hash?: string) => {
    const explorerUrl = hash ? getExplorerUrl(hash) : undefined;
    setTransactionStatus({ type, message, hash, explorerUrl });
    
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        setTransactionStatus(prev => prev.type === type ? { type: null, message: '' } : prev);
      }, 10000);
    }
  }, [getExplorerUrl]);

  // Calculate PnL based on trade history
  const calculatePnL = useCallback((history: TradeHistory[]) => {
    let totalInvestment = 0;
    let totalTokens = 0;
    
    history.forEach(trade => {
      if (trade.type === 'buy' || trade.type === 'buy-order') {
        totalInvestment += parseFloat(trade.totalValue);
        totalTokens += parseFloat(trade.amount);
      } else if (trade.type === 'sell' || trade.type === 'sell-order') {
        totalInvestment -= parseFloat(trade.totalValue);
        totalTokens -= parseFloat(trade.amount);
      }
    });

    const currentPrice = activeSellOrders.length > 0 ? parseFloat(activeSellOrders[0].price) : 0.001;
    setUnrealizedPnL(totalTokens * (currentPrice - (totalTokens > 0 ? totalInvestment / totalTokens : 0)));
  }, [activeSellOrders]);

  // Safe contract call wrapper to handle RPC/CORS issues
  const safeContractCall = useCallback(async (
    contractCall: () => Promise<any>,
    fallbackValue: any,
    errorMessage: string
  ): Promise<any> => {
    try {
      return await contractCall();
    } catch (error: any) {
      console.error(`${errorMessage}:`, error);
      
      // Don't show error for CORS/RPC issues, just use fallback
      if (error.message?.includes('CORS') || 
          error.message?.includes('fetch') || 
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('429')) {
        return fallbackValue;
      }
      
      // Only show user-facing errors for actual contract issues
      if (error.message?.includes('execution reverted')) {
        showTransactionStatus('error', `Contract error: ${error.message}`);
      }
      
      return fallbackValue;
    }
  }, [showTransactionStatus]);

  // Load token data with safe error handling
  const loadTokenData = useCallback(async () => {
    const riskTokenAddress = getRiskTokenAddress();
    if (!publicClient || !address || !riskTokenAddress) return;

    try {
      const [balance, symbol] = await Promise.all([
        safeContractCall(
          () => publicClient.readContract({
            address: riskTokenAddress,
            abi: RISK_TOKEN_ABI,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
          }),
          0n,
          'Failed to load token balance'
        ),
        safeContractCall(
          () => publicClient.readContract({
            address: riskTokenAddress,
            abi: RISK_TOKEN_ABI,
            functionName: 'symbol',
            args: [],
          }),
          'aRISK',
          'Failed to load token symbol'
        )
      ]);

      setTokenBalance(ethers.formatEther(balance as bigint));
      setTokenSymbol(symbol as string);

    } catch (error) {
      console.error('Failed to load token data:', error);
      // Set default values on error
      setTokenBalance('0');
      setTokenSymbol('aRISK');
    }
  }, [publicClient, address, getRiskTokenAddress, safeContractCall]);

  // Load insurance status with safe error handling
  const loadInsuranceStatus = useCallback(async () => {
    const secondaryMarketAddress = getSecondaryMarketAddress();
    if (!publicClient || !address || !secondaryMarketAddress) return;

    try {
      const status = await safeContractCall(
        () => publicClient.readContract({
          address: secondaryMarketAddress,
          abi: SECONDARY_MARKET_ABI,
          functionName: 'getUserInsuranceStatus',
          args: [address],
        }),
        [false, 0n, 0n, 0n, '0x0000000000000000000000000000000000000000'],
        'Failed to load insurance status'
      ) as [boolean, bigint, bigint, bigint, string];

      const collateralizationRatio = Number(status[1]);
      
      setInsuranceStatus({
        hasActivePolicy: status[0],
        collateralizationRatio: collateralizationRatio > 1000000 ? collateralizationRatio / 10000 : collateralizationRatio,
        coverage: ethers.formatEther(status[2]),
        premium: ethers.formatEther(status[3]),
        paymentToken: status[4]
      });

    } catch (error) {
      console.error('Failed to load insurance status:', error);
      setInsuranceStatus(null);
    }
  }, [publicClient, address, getSecondaryMarketAddress, safeContractCall]);

  // Load sell orders with CORRECT paginated function
  const loadSellOrders = useCallback(async (): Promise<Order[]> => {
    const secondaryMarketAddress = getSecondaryMarketAddress();
    if (!publicClient || !secondaryMarketAddress) return [];

    try {
      // CORRECT: Contract returns [orders[], newCursor]
      const result = await safeContractCall(
        () => publicClient.readContract({
          address: secondaryMarketAddress,
          abi: SECONDARY_MARKET_ABI,
          functionName: 'getActiveSellOrders',
          args: [0n, 10n], // cursor=0, limit=10
        }),
        [[], 0n],
        'Failed to load sell orders'
      ) as [any[], bigint];

      const [orders, newCursor] = result;
      
      const formattedSellOrders: Order[] = orders.map((order: any, index: number) => {
        const tokenAmount = ethers.formatEther(order.tokenAmount || 0n);
        const price = ethers.formatEther(order.price || 0n);
        return {
          orderId: index,
          user: order.user || '0x0000000000000000000000000000000000000000',
          tokenAmount,
          price,
          paymentToken: order.paymentToken || '0x0000000000000000000000000000000000000000',
          createdAt: Number(order.createdAt || 0),
          active: order.active || false,
          totalPrice: (parseFloat(tokenAmount) * parseFloat(price)).toFixed(6)
        };
      });

      setActiveSellOrders(formattedSellOrders);
      return formattedSellOrders;
    } catch (error) {
      console.error('Failed to load sell orders:', error);
      setActiveSellOrders([]);
      return [];
    }
  }, [publicClient, getSecondaryMarketAddress, safeContractCall]);

  // Load buy orders with CORRECT paginated function
  const loadBuyOrders = useCallback(async (): Promise<Order[]> => {
    const secondaryMarketAddress = getSecondaryMarketAddress();
    if (!publicClient || !secondaryMarketAddress) return [];

    try {
      // CORRECT: Contract returns [orders[], newCursor]
      const result = await safeContractCall(
        () => publicClient.readContract({
          address: secondaryMarketAddress,
          abi: SECONDARY_MARKET_ABI,
          functionName: 'getActiveBuyOrders',
          args: [0n, 10n], // cursor=0, limit=10
        }),
        [[], 0n],
        'Failed to load buy orders'
      ) as [any[], bigint];

      const [orders, newCursor] = result;
      
      const formattedBuyOrders: Order[] = orders.map((order: any, index: number) => {
        const tokenAmount = ethers.formatEther(order.tokenAmount || 0n);
        const price = ethers.formatEther(order.price || 0n);
        return {
          orderId: index,
          user: order.user || '0x0000000000000000000000000000000000000000',
          tokenAmount,
          price,
          paymentToken: order.paymentToken || '0x0000000000000000000000000000000000000000',
          createdAt: Number(order.createdAt || 0),
          active: order.active || false,
          totalPrice: (parseFloat(tokenAmount) * parseFloat(price)).toFixed(6)
        };
      });

      setActiveBuyOrders(formattedBuyOrders);
      return formattedBuyOrders;
    } catch (error) {
      console.error('Failed to load buy orders:', error);
      setActiveBuyOrders([]);
      return [];
    }
  }, [publicClient, getSecondaryMarketAddress, safeContractCall]);

  // Load all market data
  const loadMarketData = useCallback(async () => {
    const [sellOrders, buyOrders] = await Promise.all([
      loadSellOrders(),
      loadBuyOrders()
    ]);
    
    // Save to localStorage for persistence
    saveActiveOrders(sellOrders, buyOrders);
  }, [loadSellOrders, loadBuyOrders, saveActiveOrders]);

  // Clear all data when wallet disconnects
const clearPersistedData = useCallback(() => {
  setTradeHistory([]);
  setActiveSellOrders([]);
  setActiveBuyOrders([]);
  
  // Clear all localStorage entries for this component
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.startsWith(STORAGE_KEYS.TRADE_HISTORY) || key.startsWith(STORAGE_KEYS.ACTIVE_ORDERS)) {
      localStorage.removeItem(key);
    }
  });
}, []);

  // Create sell order
  const createSellOrder = async () => {
    const secondaryMarketAddress = getSecondaryMarketAddress();
    const riskTokenAddress = getRiskTokenAddress();
    
    if (!walletClient || !secondaryMarketAddress || !riskTokenAddress || !sellAmount || !sellPrice || !publicClient || !address) {
      showTransactionStatus('error', 'Missing required parameters for sell order');
      return;
    }

    setIsLoading(true);
    showTransactionStatus('pending', 'Creating sell order...');

    try {
      const tokenAmountWei = ethers.parseEther(sellAmount);
      const priceWei = ethers.parseEther(sellPrice);

      console.log('🔄 Sell order attempt:', {
        seller: address,
        tokenAmount: sellAmount,
        tokenAmountWei: tokenAmountWei.toString(),
        priceWei: priceWei.toString(),
        contract: secondaryMarketAddress
      });

      // Check balance
      const currentBalance = await publicClient.readContract({
        address: riskTokenAddress,
        abi: RISK_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }) as bigint;

      console.log('💰 Token balance:', currentBalance.toString());

      if (tokenAmountWei > currentBalance) {
        throw new Error(`Insufficient ${tokenSymbol} balance. Have ${ethers.formatEther(currentBalance)}, need ${sellAmount}`);
      }

      // Check allowance
      const allowance = await publicClient.readContract({
        address: riskTokenAddress,
        abi: RISK_TOKEN_ABI,
        functionName: 'allowance',
        args: [address, secondaryMarketAddress],
      }) as bigint;

      console.log('📝 Current allowance:', allowance.toString());

      if (allowance < tokenAmountWei) {
        console.log('🔒 Approving tokens...');
        showTransactionStatus('info', 'Approving tokens for trading...');
        
        const approveHash = await walletClient.writeContract({
          address: riskTokenAddress,
          abi: RISK_TOKEN_ABI,
          functionName: 'approve',
          args: [secondaryMarketAddress, tokenAmountWei],
          gas: 100000n,
        });

        console.log('✅ Approval transaction sent:', approveHash);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        showTransactionStatus('success', 'Tokens approved successfully');
      }

      // Test the contract call with simulation first
      try {
        const simulation = await publicClient.simulateContract({
          address: secondaryMarketAddress,
          abi: SECONDARY_MARKET_ABI,
          functionName: 'createSellOrder',
          args: [tokenAmountWei, priceWei, '0x0000000000000000000000000000000000000000'],
          account: address,
        });
        console.log('✅ Sell order simulation successful');
      } catch (simError: any) {
        console.error('❌ Sell order simulation failed:', simError.message);
        throw new Error(`Sell order will fail: ${simError.details || simError.message}`);
      }

      // Create sell order
      console.log('🚀 Creating sell order...');
      const hash = await walletClient.writeContract({
        address: secondaryMarketAddress,
        abi: SECONDARY_MARKET_ABI,
        functionName: 'createSellOrder',
        args: [tokenAmountWei, priceWei, '0x0000000000000000000000000000000000000000'],
        gas: 500000n,
      });

      console.log('✅ Sell order transaction sent:', hash);
      showTransactionStatus('pending', 'Waiting for sell order confirmation...', hash);
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1,
      });
      
      if (receipt.status === 'success') {
        console.log('🎉 Sell order created successfully!');
        
        // Add to trade history with persistent storage
        const newTrade: TradeHistory = {
          type: 'sell-order',
          amount: sellAmount,
          price: sellPrice,
          totalValue: (parseFloat(sellAmount) * parseFloat(sellPrice)).toFixed(6),
          timestamp: Date.now(),
          hash: hash,
          explorerUrl: getExplorerUrl(hash),
          status: 'created',
          chainId: chainId
        };
        
        const updatedHistory = [newTrade, ...tradeHistory];
        setTradeHistory(updatedHistory);
        saveTradeHistory(updatedHistory);
        
        showTransactionStatus('success', `Sell order created for ${sellAmount} ${tokenSymbol} at ${sellPrice} ETH each!`, hash);
        setSellAmount('');
        setSellPrice('');
        await loadTokenData();
        await loadMarketData();
      } else {
        console.error('❌ Sell order failed on-chain');
        throw new Error('Sell order creation failed on-chain');
      }

    } catch (error: any) {
      console.error('💥 Sell order creation failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('user rejected')) {
        showTransactionStatus('error', 'Transaction rejected by user');
      } else if (errorMessage.includes('insufficient balance')) {
        showTransactionStatus('error', `Insufficient ${tokenSymbol} balance for sell order`);
      } else if (errorMessage.includes('execution reverted')) {
        showTransactionStatus('error', `Contract execution reverted: ${errorMessage}`);
      } else if (errorMessage.includes('TokenTransferFailed')) {
        showTransactionStatus('error', 'Token transfer failed - check if trading is enabled');
      } else {
        showTransactionStatus('error', `Sell order failed: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Create buy order - CORRECTED for contract calculation
  const createBuyOrder = async () => {
    const secondaryMarketAddress = getSecondaryMarketAddress();
    
    if (!walletClient || !secondaryMarketAddress || !buyAmount || !buyPrice || !publicClient || !address) {
      showTransactionStatus('error', 'Missing required parameters for buy order');
      return;
    }

    setIsLoading(true);
    showTransactionStatus('pending', 'Creating buy order...');

    try {
      const tokenAmountWei = ethers.parseEther(buyAmount);
      const priceWei = ethers.parseEther(buyPrice);
      
      // CORRECTED: Contract divides by 1e18 internally, so we send (amount * price) as total
      const totalPrice = (tokenAmountWei * priceWei) / ethers.parseEther("1");

      console.log('Buy order details:', {
        tokenAmount: buyAmount,
        price: buyPrice,
        tokenAmountWei: tokenAmountWei.toString(),
        priceWei: priceWei.toString(),
        totalPrice: totalPrice.toString(),
        totalPriceETH: ethers.formatEther(totalPrice),
        expectedByContract: `Contract expects: ${ethers.formatEther(totalPrice)} ETH`
      });

      // Check ETH balance
      const ethBalance = await publicClient.getBalance({ address });
      const gasBuffer = ethers.parseEther("0.01");
      
      console.log('ETH balance check:', {
        needed: ethers.formatEther(totalPrice + gasBuffer),
        balance: ethers.formatEther(ethBalance),
        totalPriceWei: totalPrice.toString()
      });

      if (totalPrice + gasBuffer > ethBalance) {
        throw new Error(`Insufficient ETH balance. Need ${ethers.formatEther(totalPrice)} ETH for order + gas, but have ${ethers.formatEther(ethBalance)} ETH`);
      }

      // Test with simulation first
      try {
        console.log('Simulating transaction with corrected ETH amount...');
        const simulation = await publicClient.simulateContract({
          address: secondaryMarketAddress,
          abi: SECONDARY_MARKET_ABI,
          functionName: 'createBuyOrder',
          args: [
            BigInt(tokenAmountWei.toString()),
            BigInt(priceWei.toString()),
            '0x0000000000000000000000000000000000000000'
          ],
          value: totalPrice,
          account: address,
        });
        console.log('✅ Simulation successful with corrected ETH amount');
      } catch (simError: any) {
        console.error('❌ Simulation failed:', simError.message);
        if (simError.details) {
          console.error('Revert details:', simError.details);
        }
        throw new Error(`Transaction will fail: ${simError.details || simError.message}`);
      }

      // Create buy order with CORRECTED ETH amount
      const hash = await walletClient.writeContract({
        address: secondaryMarketAddress,
        abi: SECONDARY_MARKET_ABI,
        functionName: 'createBuyOrder',
        args: [
          BigInt(tokenAmountWei.toString()),
          BigInt(priceWei.toString()),
          '0x0000000000000000000000000000000000000000'
        ],
        value: totalPrice,
        gas: 500000n,
      });

      showTransactionStatus('pending', 'Waiting for buy order confirmation...', hash);
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1,
      });
      
      if (receipt.status === 'success') {
        // Add to trade history with persistent storage
        const newTrade: TradeHistory = {
          type: 'buy-order',
          amount: buyAmount,
          price: buyPrice,
          totalValue: (parseFloat(buyAmount) * parseFloat(buyPrice)).toFixed(6),
          timestamp: Date.now(),
          hash: hash,
          explorerUrl: getExplorerUrl(hash),
          status: 'created',
          chainId: chainId
        };
        
        const updatedHistory = [newTrade, ...tradeHistory];
        setTradeHistory(updatedHistory);
        saveTradeHistory(updatedHistory);
        
        showTransactionStatus('success', `Buy order created for ${buyAmount} ${tokenSymbol} at ${buyPrice} ETH each!`, hash);
        setBuyAmount('');
        setBuyPrice('');
        await loadTokenData();
        await loadMarketData();
      } else {
        throw new Error('Buy order creation failed on-chain');
      }

    } catch (error: any) {
      console.error('Buy order creation failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('user rejected')) {
        showTransactionStatus('error', 'Transaction rejected by user');
      } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('Insufficient ETH')) {
        showTransactionStatus('error', 'Insufficient ETH balance for buy order');
      } else if (errorMessage.includes('execution reverted') || errorMessage.includes('Transaction will fail')) {
        showTransactionStatus('error', `Contract error: ${errorMessage}`);
      } else if (errorMessage.includes('gas')) {
        showTransactionStatus('error', 'Gas estimation failed - try with smaller amounts');
      } else {
        showTransactionStatus('error', `Buy order failed: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fill sell order
  const fillSellOrder = async (orderId: number) => {
    const secondaryMarketAddress = getSecondaryMarketAddress();
    
    if (!walletClient || !secondaryMarketAddress || !publicClient || !address) {
      showTransactionStatus('error', 'Missing required parameters');
      return;
    }

    setIsLoading(true);
    showTransactionStatus('pending', `Filling sell order #${orderId}...`);

    try {
      const order = activeSellOrders[orderId];
      if (!order) {
        throw new Error('Order not found');
      }

      // CORRECTED: Contract divides by 1e18 internally
      const tokenAmountWei = ethers.parseEther(order.tokenAmount);
      const priceWei = ethers.parseEther(order.price);
      const totalPrice = (tokenAmountWei * priceWei) / ethers.parseEther("1");

      // Check ETH balance (include buffer for gas)
      const ethBalance = await publicClient.getBalance({ address });
      const gasBuffer = ethers.parseEther("0.001");
      
      if (totalPrice + gasBuffer > ethBalance) {
        throw new Error(`Insufficient ETH balance. Need ${ethers.formatEther(totalPrice)} ETH but have ${ethers.formatEther(ethBalance)} ETH`);
      }

      // Fill the sell order
      const hash = await walletClient.writeContract({
        address: secondaryMarketAddress,
        abi: SECONDARY_MARKET_ABI,
        functionName: 'fillSellOrder',
        args: [BigInt(orderId)],
        value: totalPrice,
        gas: 500000n,
      });

      showTransactionStatus('pending', 'Waiting for order fill confirmation...', hash);
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        confirmations: 1,
      });
      
      if (receipt.status === 'success') {
        // Add to trade history with persistent storage
        const newTrade: TradeHistory = {
          type: 'buy',
          amount: order.tokenAmount,
          price: order.price,
          totalValue: order.totalPrice || '0',
          timestamp: Date.now(),
          hash: hash,
          explorerUrl: getExplorerUrl(hash),
          status: 'filled',
          chainId: chainId
        };
        
        const updatedHistory = [newTrade, ...tradeHistory];
        setTradeHistory(updatedHistory);
        saveTradeHistory(updatedHistory);
        
        showTransactionStatus('success', `Successfully purchased ${order.tokenAmount} ${tokenSymbol} from order #${orderId}!`, hash);
        await loadTokenData();
        await loadMarketData();
      } else {
        throw new Error('Order fill failed on-chain');
      }

    } catch (error: any) {
      console.error('Order fill failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('user rejected')) {
        showTransactionStatus('error', 'Transaction rejected by user');
      } else if (errorMessage.includes('insufficient funds')) {
        showTransactionStatus('error', 'Insufficient ETH balance for purchase');
      } else if (errorMessage.includes('execution reverted')) {
        showTransactionStatus('error', 'Contract execution reverted - order may be filled or cancelled');
      } else if (errorMessage.includes('gas')) {
        showTransactionStatus('error', 'Gas estimation failed - try again');
      } else {
        showTransactionStatus('error', `Order fill failed: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load all data on mount
  useEffect(() => {
    if (address && publicClient) {
      // Load persisted data first
      const persistedHistory = loadTradeHistory();
      setTradeHistory(persistedHistory);
      
      const persistedOrders = loadActiveOrders();
      setActiveSellOrders(persistedOrders.sellOrders);
      setActiveBuyOrders(persistedOrders.buyOrders);
      
      // Then load fresh data from blockchain
      loadTokenData();
      loadInsuranceStatus();
      loadMarketData();
    } else {
      clearPersistedData();
    }
  }, [address, publicClient, chainId, loadTokenData, loadInsuranceStatus, loadMarketData, loadTradeHistory, loadActiveOrders, clearPersistedData]);

  // Calculate PnL when trade history changes
  useEffect(() => {
    calculatePnL(tradeHistory);
  }, [tradeHistory, calculatePnL]);

  const canCreateSellOrder = Boolean(
    walletClient && 
    sellAmount && 
    sellPrice &&
    parseFloat(sellAmount) > 0 &&
    parseFloat(sellPrice) > 0 &&
    parseFloat(sellAmount) <= parseFloat(tokenBalance)
  );

  const canCreateBuyOrder = Boolean(
    walletClient && 
    buyAmount && 
    buyPrice &&
    parseFloat(buyAmount) > 0 &&
    parseFloat(buyPrice) > 0
  );

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
        <div className="text-center py-4">
          <div className="text-2xl mb-2">🔐</div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Connect Your Wallet</h3>
          <p className="text-gray-600 text-xs">Connect your wallet to trade risk tokens</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
      <div className="flex justify-between items-start mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Institutional Risk Market</h1>
        <button
          onClick={() => setShowInfoModal(true)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Market Info
        </button>
      </div>
      
      {transactionStatus.type && (
        <div className={`mb-4 p-3 rounded-lg ${
          transactionStatus.type === 'success' ? 'bg-green-50 border border-green-200' :
          transactionStatus.type === 'error' ? 'bg-red-50 border border-red-200' :
          transactionStatus.type === 'pending' ? 'bg-blue-50 border border-blue-200' :
          'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center justify-between">
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
              <div className={`text-sm whitespace-pre-line ${
                transactionStatus.type === 'success' ? 'text-green-800' :
                transactionStatus.type === 'error' ? 'text-red-800' :
                transactionStatus.type === 'pending' ? 'text-blue-800' :
                'text-yellow-800'
              }`}>
                {transactionStatus.message}
                {transactionStatus.hash && transactionStatus.explorerUrl && (
                  <div className="text-xs mt-1">
                    <a 
                      href={transactionStatus.explorerUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      View on Explorer: {transactionStatus.hash.slice(0, 8)}...{transactionStatus.hash.slice(-6)}
                    </a>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setTransactionStatus({ type: null, message: '' })}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Market Overview - Compact Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Portfolio Summary - Compact */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-blue-800 mb-2">Portfolio</h3>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-blue-700">Holdings:</span>
              <span className="text-xs font-bold text-blue-900">{parseFloat(tokenBalance).toLocaleString()} {tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-blue-700">Unrealized P&L:</span>
              <span className={`text-xs font-bold ${unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(4)} ETH
              </span>
            </div>
          </div>
        </div>

        {/* Insurance Status - Compact */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-purple-800 mb-2">Risk Coverage</h3>
          {insuranceStatus?.hasActivePolicy ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-purple-700">Coverage:</span>
                <span className="text-xs font-bold text-purple-900">
                  {parseFloat(insuranceStatus.coverage).toFixed(6)} {tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-purple-700">Collateral Ratio:</span>
                <span className="text-xs font-bold text-purple-900">
                  {insuranceStatus.collateralizationRatio > 1000 
                    ? (insuranceStatus.collateralizationRatio / 100).toFixed(1) + '%'
                    : insuranceStatus.collateralizationRatio + '%'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-xs text-purple-600">No active policy</span>
            </div>
          )}
        </div>
      </div>

      {/* Create Orders - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Sell Order Panel */}
        <div className="border border-red-200 rounded-lg p-3 bg-red-50">
          <h3 className="text-sm font-semibold mb-2 text-red-700">Create Sell Order</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tokenSymbol} Amount</label>
              <input
                type="number"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                placeholder="100"
                min="1"
                step="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Price per {tokenSymbol} (ETH)</label>
              <input
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                placeholder="0.001"
                min="0.000001"
                step="0.000001"
              />
            </div>
            {sellAmount && sellPrice && (
              <div className="bg-white border border-red-200 rounded p-1 text-center">
                <div className="text-xs text-red-700 font-medium">
                  Total: {(parseFloat(sellAmount) * parseFloat(sellPrice)).toFixed(6)} ETH
                </div>
              </div>
            )}
            <button 
              onClick={createSellOrder}
              disabled={!canCreateSellOrder || isLoading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 
               !canCreateSellOrder ? 'Enter Valid Amounts' : `Sell ${sellAmount} ${tokenSymbol}`}
            </button>
          </div>
        </div>

        {/* Buy Order Panel */}
        <div className="border border-green-200 rounded-lg p-3 bg-green-50">
          <h3 className="text-sm font-semibold mb-2 text-green-700">Create Buy Order</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tokenSymbol} Amount</label>
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="100"
                min="1"
                step="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Price per {tokenSymbol} (ETH)</label>
              <input
                type="number"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                placeholder="0.001"
                min="0.000001"
                step="0.000001"
              />
            </div>
            {buyAmount && buyPrice && (
              <div className="bg-white border border-green-200 rounded p-1 text-center">
                <div className="text-xs text-green-700 font-medium">
                  Total: {(parseFloat(buyAmount) * parseFloat(buyPrice)).toFixed(6)} ETH
                </div>
              </div>
            )}
            <button 
              onClick={createBuyOrder}
              disabled={!canCreateBuyOrder || isLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 
               !canCreateBuyOrder ? 'Enter Valid Amounts' : `Buy ${buyAmount} ${tokenSymbol}`}
            </button>
          </div>
        </div>
      </div>

      {/* Active Orders & Trade History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Orders */}
        <div className="space-y-3">
          {/* Active Sell Orders */}
          {activeSellOrders.length > 0 && (
            <div className="border border-red-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-red-700">Active Sell Orders</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeSellOrders.map((order, index) => (
                  <div key={index} className="bg-white border border-red-200 rounded-lg p-2">
                    <div className="flex justify-between items-center cursor-pointer"
                         onClick={() => setExpandedOrder(expandedOrder === index ? null : index)}>
                      <div className="flex items-center space-x-2">
                        <div className={`transform transition-transform ${expandedOrder === index ? 'rotate-90' : ''}`}>
                          ▶
                        </div>
                        <div>
                          <div className="text-xs font-medium text-red-800">
                            {order.tokenAmount} {tokenSymbol}
                          </div>
                          <div className="text-xs text-red-600">
                            {order.price} ETH each
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-red-700">
                          {order.totalPrice} ETH
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fillSellOrder(index);
                          }}
                          disabled={isLoading}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-2 rounded transition-colors disabled:bg-gray-400"
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                    
                    {expandedOrder === index && (
                      <div className="mt-2 pt-2 border-t border-red-100">
                        <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                          <div>Seller: {order.user.slice(0, 6)}...{order.user.slice(-4)}</div>
                          <div>Created: {new Date(order.createdAt * 1000).toLocaleDateString()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Buy Orders */}
          {activeBuyOrders.length > 0 && (
            <div className="border border-green-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold mb-2 text-green-700">Active Buy Orders</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeBuyOrders.map((order, index) => (
                  <div key={index} className="bg-white border border-green-200 rounded-lg p-2">
                    <div className="flex justify-between items-center cursor-pointer"
                         onClick={() => setExpandedOrder(expandedOrder === index + 1000 ? null : index + 1000)}>
                      <div className="flex items-center space-x-2">
                        <div className={`transform transition-transform ${expandedOrder === index + 1000 ? 'rotate-90' : ''}`}>
                          ▶
                        </div>
                        <div>
                          <div className="text-xs font-medium text-green-800">
                            {order.tokenAmount} {tokenSymbol}
                          </div>
                          <div className="text-xs text-green-600">
                            {order.price} ETH each
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-green-700">
                        {order.totalPrice} ETH
                      </div>
                    </div>
                    
                    {expandedOrder === index + 1000 && (
                      <div className="mt-2 pt-2 border-t border-green-100">
                        <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                          <div>Buyer: {order.user.slice(0, 6)}...{order.user.slice(-4)}</div>
                          <div>Created: {new Date(order.createdAt * 1000).toLocaleDateString()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Trade History with Explorer Links */}
        <div className="border border-blue-200 rounded-lg p-3">
          <h3 className="text-sm font-semibold mb-2 text-blue-700">Trade History</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {tradeHistory.slice(0, 8).map((trade, index) => (
              <div key={index} className="bg-white border border-blue-200 rounded-lg p-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${trade.type === 'buy' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <div>
                      <div className="text-xs font-medium text-gray-800">
                        {trade.type === 'buy' ? 'Bought' : 'Sold'} {trade.amount} {tokenSymbol}
                      </div>
                      <div className="text-xs text-gray-600">
                        {trade.price} ETH each
                      </div>
                      {trade.hash && trade.explorerUrl && (
                        <a 
                          href={trade.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View on Explorer
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-800">
                      {trade.totalValue} ETH
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {tradeHistory.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-xs">
                No trade history yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
           <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Institutional Risk Market</h1>
            
            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Market Overview</h4>
                <p>
                  This institutional market facilitates trading of aRISK tokens representing fractional 
                  insurance shares in the Antidote protocol.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-green-600 mb-1">Bid Side (Buy Orders)</h5>
                  <ul className="text-xs space-y-1">
                    <li>• Institutional buyers seeking exposure</li>
                    <li>• Risk management firms</li>
                    <li>• Hedge funds & market makers</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-red-600 mb-1">Ask Side (Sell Orders)</h5>
                  <ul className="text-xs space-y-1">
                    <li>• Insurance providers</li>
                    <li>• Risk transfer participants</li>
                    <li>• Portfolio rebalancing</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-2">P&L Calculation</h4>
                <p className="text-xs">
                  Profit & Loss is calculated based on your average purchase price versus current 
                  market value. Unrealized P&L shows potential gains/losses on current holdings.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <h5 className="font-medium text-yellow-800 mb-1">Institutional Access Only</h5>
                <p className="text-xs text-yellow-700">
                  This market is designed for professional risk management. All participants 
                  undergo compliance verification and maintain institutional-grade trading standards.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Got it
              </button>
            </div>
          </div>
        
      )}
    </div>
  );
}