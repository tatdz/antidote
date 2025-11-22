// lib/uniswap-service.ts
import { getChainConfig } from './chain-config';
import { Address } from 'viem';

// Simple ERC20 ABI for direct transfers
export const ERC20_ABI = [
  {
    "inputs": [
      {"internalType": "address","name": "to","type": "address"},
      {"internalType": "uint256","name": "amount","type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"internalType": "bool","name": "","type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address","name": "owner","type": "address"},
      {"internalType": "address","name": "spender","type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address","name": "spender","type": "address"},
      {"internalType": "uint256","name": "amount","type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool","name": "","type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8","name": "","type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Risk Token ABI for direct minting/burning
export const RISK_TOKEN_DIRECT_ABI = [
  ...ERC20_ABI,
  {
    "inputs": [
      {"internalType": "address","name": "user","type": "address"},
      {"internalType": "uint256","name": "coverageAmount","type": "uint256"},
      {"internalType": "uint256","name": "premiumPaid","type": "uint256"}
    ],
    "name": "mintTokensForInsurance",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address","name": "user","type": "address"},
      {"internalType": "uint256","name": "tokenAmount","type": "uint256"},
      {"internalType": "uint256","name": "claimAmount","type": "uint256"}
    ],
    "name": "burnTokensForClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTokenPrice",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export class UniswapService {
  static async getSwapQuote(
    publicClient: any,
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<{ amountOut: bigint; gasEstimate: bigint; success: boolean; error?: string }> {
    try {
      console.log(`Getting swap quote: ${tokenIn} -> ${tokenOut}, amount: ${amountIn}`);
      
      // For RiskToken, we'll use direct pricing instead of StateView
      const config = getChainConfig(chainId);
      if (!config) {
        throw new Error('Chain not configured');
      }

      // If swapping with RiskToken, use direct pricing
      if (tokenOut === config.riskTokenAddress || tokenIn === config.riskTokenAddress) {
        return await this.getRiskTokenQuote(
          publicClient,
          chainId,
          tokenIn,
          tokenOut,
          amountIn
        );
      }

      // For other tokens, try StateView with proper error handling
      if (!config.stateViewAddress) {
        throw new Error('StateView not configured for this chain');
      }

      try {
        const UNISWAP_STATE_VIEW_ABI = [
          {
            "inputs": [
              {
                "components": [
                  {"internalType": "address","name": "tokenIn","type": "address"},
                  {"internalType": "address","name": "tokenOut","type": "address"},
                  {"internalType": "uint256","name": "amountIn","type": "uint256"},
                  {"internalType": "uint24","name": "fee","type": "uint24"},
                  {"internalType": "uint160","name": "sqrtPriceLimitX96","type": "uint160"}
                ],
                "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
                "name": "params",
                "type": "tuple"
              }
            ],
            "name": "quoteExactInputSingle",
            "outputs": [
              {"internalType": "uint256","name": "amountOut","type": "uint256"},
              {"internalType": "uint160","name": "sqrtPriceX96After","type": "uint160"},
              {"internalType": "uint32","name": "initializedTicksCrossed","type": "uint32"},
              {"internalType": "uint256","name": "gasEstimate","type": "uint256"}
            ],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ] as const;

        const quote = await publicClient.readContract({
          address: config.stateViewAddress as Address,
          abi: UNISWAP_STATE_VIEW_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{
            tokenIn: tokenIn as Address,
            tokenOut: tokenOut as Address,
            amountIn,
            fee: config.poolConfig.fee,
            sqrtPriceLimitX96: 0
          }]
        });

        const [amountOut, , , gasEstimate] = quote as [bigint, bigint, number, bigint];
        
        console.log(`StateView quote successful: ${amountOut} out, gas: ${gasEstimate}`);
        
        return {
          amountOut,
          gasEstimate,
          success: true
        };
      } catch (stateViewError) {
        console.log('StateView failed, using direct calculation:', stateViewError);
        return await this.getDirectQuote(chainId, tokenIn, tokenOut, amountIn);
      }
      
    } catch (error: any) {
      console.error('Failed to get swap quote:', error);
      return await this.getDirectQuote(chainId, tokenIn, tokenOut, amountIn);
    }
  }

  private static async getRiskTokenQuote(
    publicClient: any,
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<{ amountOut: bigint; gasEstimate: bigint; success: boolean; error?: string }> {
    const config = getChainConfig(chainId);
    if (!config?.riskTokenAddress) {
      throw new Error('RiskToken not configured');
    }

    try {
      // Get RiskToken price from contract
      const tokenPrice = await publicClient.readContract({
        address: config.riskTokenAddress as Address,
        abi: RISK_TOKEN_DIRECT_ABI,
        functionName: 'getTokenPrice',
      }) as bigint;

      let amountOut: bigint;
      
      if (tokenIn === '0x0000000000000000000000000000000000000000') {
        // ETH -> RiskToken: amountIn / tokenPrice
        amountOut = amountIn * BigInt(1e18) / tokenPrice;
      } else {
        // RiskToken -> ETH: amountIn * tokenPrice / 1e18
        amountOut = (amountIn * tokenPrice) / BigInt(1e18);
      }

      // Apply 2% slippage for safety
      amountOut = amountOut * BigInt(98) / BigInt(100);

      console.log(`RiskToken direct quote: ${amountIn} -> ${amountOut}`);

      return {
        amountOut,
        gasEstimate: BigInt(200000), // Estimated gas for direct transfer
        success: true
      };

    } catch (error) {
      console.error('RiskToken price fetch failed, using fallback:', error);
      return this.getDirectQuote(chainId, tokenIn, tokenOut, amountIn);
    }
  }

  private static async getDirectQuote(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<{ amountOut: bigint; gasEstimate: bigint; success: boolean; error?: string }> {
    // Fallback direct calculation
    let amountOut: bigint;
    let gasEstimate = BigInt(200000);

    const config = getChainConfig(chainId);
    const isRiskTokenIn = tokenIn === config?.riskTokenAddress;
    const isRiskTokenOut = tokenOut === config?.riskTokenAddress;

    if (isRiskTokenOut && tokenIn === '0x0000000000000000000000000000000000000000') {
      // ETH -> RiskToken: 1 ETH = ~1000 RiskTokens
      amountOut = amountIn * BigInt(950) / BigInt(1000); // 5% slippage
    } else if (isRiskTokenIn && tokenOut === '0x0000000000000000000000000000000000000000') {
      // RiskToken -> ETH: 1000 RiskTokens = ~0.95 ETH
      amountOut = amountIn * BigInt(95) / BigInt(100000); // Adjusted for decimals
    } else if (tokenIn === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      // ETH -> Other: 2% slippage
      amountOut = amountIn * BigInt(98) / BigInt(100);
    } else if (tokenOut === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      // Other -> ETH: 2% slippage
      amountOut = amountIn * BigInt(98) / BigInt(100);
    } else {
      // Token -> Token: 3% slippage
      amountOut = amountIn * BigInt(97) / BigInt(100);
    }

    // Ensure minimum output
    if (amountOut < BigInt(1000)) {
      amountOut = BigInt(1000);
    }

    console.log(`Direct fallback quote: ${amountIn} -> ${amountOut}`);

    return {
      amountOut,
      gasEstimate,
      success: false,
      error: 'Using direct calculation fallback'
    };
  }

  static async executeSwap(
    walletClient: any,
    publicClient: any,
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    amountOutMin: bigint,
    recipient: string
  ): Promise<{ success: boolean; hash?: string; error?: string; explorerUrl?: string }> {
    const config = getChainConfig(chainId);
    if (!config) {
      return {
        success: false,
        error: 'Chain not configured'
      };
    }

    try {
      console.log(`Executing swap: ${tokenIn} -> ${tokenOut}`);
      console.log(`Amount in: ${amountIn}, Min out: ${amountOutMin}`);
      
      // Check wallet balance first
      const balance = await publicClient.getBalance({ address: recipient });
      console.log(`Wallet balance: ${balance}`);
      
      if (tokenIn === '0x0000000000000000000000000000000000000000' && amountIn > balance) {
        return {
          success: false,
          error: `Insufficient ETH balance. Have ${balance}, need ${amountIn}`
        };
      }

      // For RiskToken, use direct transfer instead of Universal Router
      if (tokenOut === config.riskTokenAddress || tokenIn === config.riskTokenAddress) {
        return await this.executeDirectTransfer(
          walletClient,
          publicClient,
          chainId,
          tokenIn,
          tokenOut,
          amountIn,
          recipient
        );
      }

      // For other tokens, use Universal Router with proper error handling
      if (!config.universalRouterAddress) {
        return {
          success: false,
          error: 'Universal Router not configured'
        };
      }

      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

      const UNIVERSAL_ROUTER_ABI = [
        {
          "inputs": [
            {
              "components": [
                {"internalType": "bytes","name": "commands","type": "bytes"},
                {"internalType": "bytes[]","name": "inputs","type": "bytes[]"}
              ],
              "internalType": "struct UniversalRouter.Execution",
              "name": "execution",
              "type": "tuple"
            },
            {"internalType": "uint256","name": "deadline","type": "uint256"}
          ],
          "name": "execute",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        }
      ] as const;

      // For native ETH swaps
      if (tokenIn === '0x0000000000000000000000000000000000000000') {
        const hash = await walletClient.writeContract({
          address: config.universalRouterAddress as Address,
          abi: UNIVERSAL_ROUTER_ABI,
          functionName: 'execute',
          args: [
            {
              commands: '0x00', // V4_SWAP_EXACT_IN command
              inputs: [this.encodeV4SwapParams({
                tokenIn: '0x0000000000000000000000000000000000000000',
                tokenOut: tokenOut as Address,
                amountIn,
                amountOutMin,
                recipient: recipient as Address,
                fee: config.poolConfig.fee
              })]
            },
            BigInt(deadline)
          ],
          value: amountIn
        });

        console.log(`Universal Router transaction submitted: ${hash}`);
        
        const receipt = await publicClient.waitForTransactionReceipt({ 
          hash,
          timeout: 120000
        });
        
        const explorerUrl = this.getExplorerUrl(chainId, hash);
        
        if (receipt.status === 'success') {
          console.log('Universal Router swap executed successfully');
          return {
            success: true,
            hash,
            explorerUrl
          };
        } else {
          return {
            success: false,
            error: 'Universal Router transaction failed',
            explorerUrl
          };
        }
      } else {
        // For token swaps, check allowance first
        const allowance = await publicClient.readContract({
          address: tokenIn as Address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [recipient, config.universalRouterAddress]
        }) as bigint;

        if (allowance < amountIn) {
          return {
            success: false,
            error: 'Insufficient token allowance. Please approve tokens first.'
          };
        }

        const hash = await walletClient.writeContract({
          address: config.universalRouterAddress as Address,
          abi: UNIVERSAL_ROUTER_ABI,
          functionName: 'execute',
          args: [
            {
              commands: '0x00',
              inputs: [this.encodeV4SwapParams({
                tokenIn: tokenIn as Address,
                tokenOut: tokenOut as Address,
                amountIn,
                amountOutMin,
                recipient: recipient as Address,
                fee: config.poolConfig.fee
              })]
            },
            BigInt(deadline)
          ],
          value: BigInt(0)
        });

        console.log(`Token swap transaction submitted: ${hash}`);
        
        const receipt = await publicClient.waitForTransactionReceipt({ 
          hash,
          timeout: 120000
        });
        
        const explorerUrl = this.getExplorerUrl(chainId, hash);
        
        if (receipt.status === 'success') {
          console.log('Token swap executed successfully');
          return {
            success: true,
            hash,
            explorerUrl
          };
        } else {
          return {
            success: false,
            error: 'Token swap transaction failed',
            explorerUrl
          };
        }
      }
      
    } catch (error: any) {
      console.error('Swap execution failed:', error);
      
      let errorMessage = `Swap failed: ${error.message}`;
      
      if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for transaction';
      } else if (error.message?.includes('execution reverted')) {
        errorMessage = 'Swap execution reverted - check token approvals and balances';
      } else if (error.message?.includes('allowance')) {
        errorMessage = 'Insufficient token allowance - please approve tokens first';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private static async executeDirectTransfer(
    walletClient: any,
    publicClient: any,
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    recipient: string
  ): Promise<{ success: boolean; hash?: string; error?: string; explorerUrl?: string }> {
    const config = getChainConfig(chainId);
    if (!config?.riskTokenAddress) {
      return {
        success: false,
        error: 'RiskToken not configured'
      };
    }

    try {
      let hash: string;

      if (tokenIn === '0x0000000000000000000000000000000000000000' && tokenOut === config.riskTokenAddress) {
        // ETH -> RiskToken: Use direct minting
        hash = await walletClient.writeContract({
          address: config.riskTokenAddress as Address,
          abi: RISK_TOKEN_DIRECT_ABI,
          functionName: 'mintTokensForInsurance',
          args: [recipient, amountIn, BigInt(0)], // coverageAmount = amountIn, premiumPaid = 0 for demo
          value: amountIn
        });
      } else if (tokenIn === config.riskTokenAddress && tokenOut === '0x0000000000000000000000000000000000000000') {
        // RiskToken -> ETH: Use direct transfer (simplified)
        // In production, this would burn tokens and return ETH
        hash = await walletClient.writeContract({
          address: config.riskTokenAddress as Address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [config.hookAddress, amountIn] // Transfer to hook for burning
        });
      } else {
        return {
          success: false,
          error: 'Unsupported token pair for direct transfer'
        };
      }

      console.log(`Direct transfer transaction submitted: ${hash}`);
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        timeout: 120000
      });
      
      const explorerUrl = this.getExplorerUrl(chainId, hash);
      
      if (receipt.status === 'success') {
        console.log('Direct transfer executed successfully');
        return {
          success: true,
          hash,
          explorerUrl
        };
      } else {
        return {
          success: false,
          error: 'Direct transfer transaction failed',
          explorerUrl
        };
      }
      
    } catch (error: any) {
      console.error('Direct transfer failed:', error);
      return {
        success: false,
        error: `Direct transfer failed: ${error.message}`
      };
    }
  }

  private static encodeV4SwapParams(params: {
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
    amountOutMin: bigint;
    recipient: Address;
    fee: number;
  }): `0x${string}` {
    // Proper encoding for Uniswap V4 swap parameters
    const tokenInHex = params.tokenIn.slice(2).padStart(40, '0');
    const tokenOutHex = params.tokenOut.slice(2).padStart(40, '0');
    const recipientHex = params.recipient.slice(2).padStart(40, '0');
    const amountInHex = params.amountIn.toString(16).padStart(64, '0');
    const amountOutMinHex = params.amountOutMin.toString(16).padStart(64, '0');
    const feeHex = params.fee.toString(16).padStart(6, '0');
    
    const encoded = `0x${tokenInHex}${tokenOutHex}${amountInHex}${amountOutMinHex}${recipientHex}${feeHex}`;
    return encoded as `0x${string}`;
  }

  private static getExplorerUrl(chainId: number, hash: string): string {
    const baseUrls: Record<number, string> = {
      11155111: 'https://sepolia.etherscan.io/tx', // Ethereum Sepolia
      84532: 'https://sepolia.basescan.org/tx', // Base Sepolia
    };
    
    const baseUrl = baseUrls[chainId] || 'https://etherscan.io/tx';
    return `${baseUrl}/${hash}`;
  }

  // Token approval function
  static async approveToken(
    walletClient: any,
    publicClient: any,
    tokenAddress: Address,
    spender: Address,
    amount: bigint
  ): Promise<{ success: boolean; hash?: string; error?: string; explorerUrl?: string }> {
    try {
      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amount]
      });

      console.log(`Approval transaction submitted: ${hash}`);
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      const explorerUrl = this.getExplorerUrl(await publicClient.getChainId(), hash);
      
      if (receipt.status === 'success') {
        console.log('Token approval successful');
        return {
          success: true,
          hash,
          explorerUrl
        };
      } else {
        return {
          success: false,
          error: 'Approval transaction failed',
          explorerUrl
        };
      }
      
    } catch (error: any) {
      console.error('Token approval failed:', error);
      return {
        success: false,
        error: `Approval failed: ${error.message}`
      };
    }
  }

  // Check token allowance
  static async checkAllowance(
    publicClient: any,
    tokenAddress: Address,
    owner: Address,
    spender: Address
  ): Promise<bigint> {
    try {
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, spender]
      }) as bigint;
      
      return allowance;
    } catch (error) {
      console.error('Failed to check allowance:', error);
      return BigInt(0);
    }
  }
}