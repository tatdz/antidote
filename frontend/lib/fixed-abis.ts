// lib/fixed-abis.ts
export const RISK_TOKEN_ABI = [
  // Constructor
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "admin",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_insuranceHook",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  // ERC20 Standard functions
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "claimAmount",
        "type": "uint256"
      }
    ],
    "name": "burnTokensForClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "coverageAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "premiumPaid",
        "type": "uint256"
      }
    ],
    "name": "calculateTokensForCoverage",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "disableTrading",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "enableTrading",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getHookStats",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "hookBalance",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "hookUSDCBalance",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRiskMetrics",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "totalCoverage",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalPremiums",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalClaims",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "activePolicies",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "claimsRatio",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "utilizationRate",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTokenPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserPosition",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "totalCoverage",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalPremiums",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "activePolicies",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "tokenBalance",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "lastUpdate",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "nextMintTime",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "coverageAmount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "premiumPaid",
        "type": "uint256"
      }
    ],
    "name": "mintTokensForInsurance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "deadline",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "v",
        "type": "uint8"
      },
      {
        "internalType": "bytes32",
        "name": "r",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "s",
        "type": "bytes32"
      }
    ],
    "name": "permit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalActivePolicies",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalClaimsPaid",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalCoverageProvided",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalPremiumsCollected",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // View functions for state variables
  {
    "inputs": [],
    "name": "INITIAL_SUPPLY",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_SUPPLY",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MINT_COOLDOWN",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "insuranceHook",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tradingEnabled",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "userPositions",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "totalCoverage",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalPremiums",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "activePolicies",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "tokenBalance",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "lastUpdate",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "lastMintTimestamp",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "coverageAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "premiumPaid",
        "type": "uint256"
      }
    ],
    "name": "InsurancePolicyLinked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "payoutValue",
        "type": "uint256"
      }
    ],
    "name": "RiskTokenBurned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "coverageValue",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "premiumPaid",
        "type": "uint256"
      }
    ],
    "name": "RiskTokenMinted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "TradingDisabled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "TradingEnabled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  }
] as const;

export const SECONDARY_MARKET_ABI = [
  // Constructor
  {
    "inputs": [
      {"internalType": "address","name": "_riskToken","type": "address"},
      {"internalType": "address","name": "_usdcToken","type": "address"},
      {"internalType": "address","name": "_insuranceHook","type": "address"},
      {"internalType": "address","name": "_stateView","type": "address"},
      {"internalType": "address","name": "_feeRecipient","type": "address"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  // Order management functions
  {
    "inputs": [
      {"internalType": "uint128","name": "tokenAmount","type": "uint128"},
      {"internalType": "uint128","name": "price","type": "uint128"},
      {"internalType": "address","name": "paymentToken","type": "address"}
    ],
    "name": "createSellOrder",
    "outputs": [{"internalType": "uint256","name": "orderId","type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256","name": "orderId","type": "uint256"}],
    "name": "fillSellOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint128","name": "tokenAmount","type": "uint128"},
      {"internalType": "uint128","name": "price","type": "uint128"},
      {"internalType": "address","name": "paymentToken","type": "address"}
    ],
    "name": "createBuyOrder",
    "outputs": [{"internalType": "uint256","name": "orderId","type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256","name": "orderId","type": "uint256"},
      {"internalType": "uint128","name": "fillAmount","type": "uint128"}
    ],
    "name": "fillBuyOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256","name": "orderId","type": "uint256"}],
    "name": "cancelSellOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256","name": "orderId","type": "uint256"}],
    "name": "cancelBuyOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // View functions - CORRECTED for paginated arrays
  {
    "inputs": [
      {"internalType": "uint256","name": "cursor","type": "uint256"},
      {"internalType": "uint256","name": "limit","type": "uint256"}
    ],
    "name": "getActiveSellOrders",
    "outputs": [
      {
        "components": [
          {"internalType": "address","name": "user","type": "address"},
          {"internalType": "uint128","name": "tokenAmount","type": "uint128"},
          {"internalType": "uint128","name": "price","type": "uint128"},
          {"internalType": "address","name": "paymentToken","type": "address"},
          {"internalType": "uint32","name": "createdAt","type": "uint32"},
          {"internalType": "bool","name": "active","type": "bool"}
        ],
        "internalType": "struct SecondaryMarket.Order[]",
        "name": "orders",
        "type": "tuple[]"
      },
      {"internalType": "uint256","name": "newCursor","type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256","name": "cursor","type": "uint256"},
      {"internalType": "uint256","name": "limit","type": "uint256"}
    ],
    "name": "getActiveBuyOrders",
    "outputs": [
      {
        "components": [
          {"internalType": "address","name": "user","type": "address"},
          {"internalType": "uint128","name": "tokenAmount","type": "uint128"},
          {"internalType": "uint128","name": "price","type": "uint128"},
          {"internalType": "address","name": "paymentToken","type": "address"},
          {"internalType": "uint32","name": "createdAt","type": "uint32"},
          {"internalType": "bool","name": "active","type": "bool"}
        ],
        "internalType": "struct SecondaryMarket.Order[]",
        "name": "orders",
        "type": "tuple[]"
      },
      {"internalType": "uint256","name": "newCursor","type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // User-specific order functions
  {
    "inputs": [
      {"internalType": "address","name": "user","type": "address"},
      {"internalType": "uint256","name": "cursor","type": "uint256"},
      {"internalType": "uint256","name": "limit","type": "uint256"}
    ],
    "name": "getUserSellOrders",
    "outputs": [
      {"internalType": "uint256[]","name": "orderIds","type": "uint256[]"},
      {"internalType": "uint256","name": "newCursor","type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address","name": "user","type": "address"},
      {"internalType": "uint256","name": "cursor","type": "uint256"},
      {"internalType": "uint256","name": "limit","type": "uint256"}
    ],
    "name": "getUserBuyOrders",
    "outputs": [
      {"internalType": "uint256[]","name": "orderIds","type": "uint256[]"},
      {"internalType": "uint256","name": "newCursor","type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Insurance and market stats
  {
    "inputs": [{"internalType": "address","name": "user","type": "address"}],
    "name": "getUserInsuranceStatus",
    "outputs": [
      {"internalType": "bool","name": "hasActivePolicy","type": "bool"},
      {"internalType": "uint256","name": "collateralizationRatio","type": "uint256"},
      {"internalType": "uint256","name": "coverage","type": "uint256"},
      {"internalType": "uint256","name": "premium","type": "uint256"},
      {"internalType": "address","name": "paymentToken","type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMarketStats",
    "outputs": [
      {
        "components": [
          {"internalType": "uint32","name": "totalSellOrders","type": "uint32"},
          {"internalType": "uint32","name": "totalBuyOrders","type": "uint32"},
          {"internalType": "uint32","name": "activeSellOrders","type": "uint32"},
          {"internalType": "uint32","name": "activeBuyOrders","type": "uint32"},
          {"internalType": "uint32","name": "totalInsuranceBundles","type": "uint32"}
        ],
        "internalType": "struct SecondaryMarket.MarketStats",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getHookStatistics",
    "outputs": [
      {"internalType": "uint256","name": "totalActivePolicies","type": "uint256"},
      {"internalType": "uint256","name": "riskTokenPrice","type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Price functions
  {
    "inputs": [],
    "name": "getRiskTokenPrice",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRiskTokenPriceFromPool",
    "outputs": [{"internalType": "uint256","name": "price","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  // Admin functions
  {
    "inputs": [{"internalType": "address","name": "newRecipient","type": "address"}],
    "name": "updateFeeRecipient",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "updateRiskTokenPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Emergency functions
  {
    "inputs": [],
    "name": "emergencyWithdrawETH",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address","name": "token","type": "address"}],
    "name": "emergencyWithdrawToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // State variables
  {
    "inputs": [],
    "name": "riskToken",
    "outputs": [{"internalType": "contract IRiskToken","name": "","type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "usdcToken",
    "outputs": [{"internalType": "contract IERC20","name": "","type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "insuranceHook",
    "outputs": [{"internalType": "contract IMarginCallInsuranceHook","name": "","type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "stateView",
    "outputs": [{"internalType": "contract IStateView","name": "","type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feeRecipient",
    "outputs": [{"internalType": "address","name": "","type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "TRADING_FEE_BPS",
    "outputs": [{"internalType": "uint16","name": "","type": "uint16"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "activeSellOrderCount",
    "outputs": [{"internalType": "uint32","name": "","type": "uint32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "activeBuyOrderCount",
    "outputs": [{"internalType": "uint32","name": "","type": "uint32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "name": "sellOrders",
    "outputs": [
      {"internalType": "address","name": "user","type": "address"},
      {"internalType": "uint128","name": "tokenAmount","type": "uint128"},
      {"internalType": "uint128","name": "price","type": "uint128"},
      {"internalType": "address","name": "paymentToken","type": "address"},
      {"internalType": "uint32","name": "createdAt","type": "uint32"},
      {"internalType": "bool","name": "active","type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "name": "buyOrders",
    "outputs": [
      {"internalType": "address","name": "user","type": "address"},
      {"internalType": "uint128","name": "tokenAmount","type": "uint128"},
      {"internalType": "uint128","name": "price","type": "uint128"},
      {"internalType": "address","name": "paymentToken","type": "address"},
      {"internalType": "uint32","name": "createdAt","type": "uint32"},
      {"internalType": "bool","name": "active","type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "seller", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "tokenAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "price", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "paymentToken", "type": "address"}
    ],
    "name": "SellOrderCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "buyer", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "tokenAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "totalPrice", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "paymentToken", "type": "address"}
    ],
    "name": "SellOrderFilled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256"}
    ],
    "name": "SellOrderCancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "buyer", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "tokenAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "price", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "paymentToken", "type": "address"}
    ],
    "name": "BuyOrderCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "seller", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "tokenAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "totalPrice", "type": "uint256"},
      {"indexed": false, "internalType": "address", "name": "paymentToken", "type": "address"}
    ],
    "name": "BuyOrderFilled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256"}
    ],
    "name": "BuyOrderCancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": false, "internalType": "uint256", "name": "price", "type": "uint256"}
    ],
    "name": "RiskTokenPriceUpdated",
    "type": "event"
  }
] as const;

export const UNIVERSAL_ROUTER_ABI = [
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
      {"internalType": "address","name": "from","type": "address"},
      {"internalType": "address","name": "to","type": "address"},
      {"internalType": "uint256","name": "amount","type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [{"internalType": "bool","name": "","type": "bool"}],
    "stateMutability": "nonpayable",
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
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8","name": "","type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string","name": "","type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{"internalType": "string","name": "","type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address","name": "account","type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const PYTH_ABI = [
  {
    "inputs": [{"internalType": "bytes[]","name": "updateData","type": "bytes[]"}],
    "name": "getUpdateFee",
    "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes[]","name": "updateData","type": "bytes[]"}],
    "name": "updatePriceFeeds",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32","name": "id","type": "bytes32"}],
    "name": "getPrice",
    "outputs": [
      {
        "components": [
          {"internalType": "int64","name": "price","type": "int64"},
          {"internalType": "uint64","name": "conf","type": "uint64"},
          {"internalType": "int32","name": "expo","type": "int32"},
          {"internalType": "uint256","name": "publishTime","type": "uint256"}
        ],
        "internalType": "struct PythStructs.Price",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32","name": "id","type": "bytes32"}, {"internalType": "uint256","name": "age","type": "uint256"}],
    "name": "getPriceNoOlderThan",
    "outputs": [
      {
        "components": [
          {"internalType": "int64","name": "price","type": "int64"},
          {"internalType": "uint64","name": "conf","type": "uint64"},
          {"internalType": "int32","name": "expo","type": "int32"},
          {"internalType": "uint256","name": "publishTime","type": "uint256"}
        ],
        "internalType": "struct PythStructs.Price",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const POOL_MANAGER_ABI = [
  {
    "inputs": [
      {
        "components": [
          {"internalType": "address","name": "currency0","type": "address"},
          {"internalType": "address","name": "currency1","type": "address"},
          {"internalType": "uint24","name": "fee","type": "uint24"},
          {"internalType": "int24","name": "tickSpacing","type": "int24"},
          {"internalType": "contract IHooks","name": "hooks","type": "address"}
        ],
        "internalType": "struct PoolKey",
        "name": "key",
        "type": "tuple"
      },
      {"internalType": "uint160","name": "sqrtPriceX96","type": "uint160"}
    ],
    "name": "initialize",
    "outputs": [{"internalType": "int24","name": "tick","type": "int24"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes","name": "lockData","type": "bytes"}],
    "name": "lock",
    "outputs": [{"internalType": "bytes","name": "","type": "bytes"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// ABI for ClaimVerifier with Poseidon
const CLAIM_VERIFIER_ABI = [
  {
    "type": "function",
    "name": "getUserClaimCount",
    "inputs": [{"name": "user", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isNullifierUsed",
    "inputs": [{"name": "nullifierHash", "type": "bytes32"}],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "verifyZKClaim",
    "inputs": [
      {
        "name": "proof",
        "type": "tuple",
        "components": [
          {"name": "a", "type": "uint256[2]"},
          {"name": "b", "type": "uint256[2][2]"},
          {"name": "c", "type": "uint256[2]"},
          {"name": "input", "type": "uint256[4]"}
        ]
      },
      {"name": "nullifierHash", "type": "bytes32"},
      {"name": "merkleRoot", "type": "bytes32"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ClaimVerified",
    "inputs": [
      {"name": "user", "type": "address", "indexed": true},
      {"name": "policyId", "type": "uint256", "indexed": true},
      {"name": "claimAmount", "type": "uint256", "indexed": false},
      {"name": "claimHash", "type": "bytes32", "indexed": false},
      {"name": "nullifierHash", "type": "bytes32", "indexed": false},
      {"name": "timestamp", "type": "uint256", "indexed": false}
    ]
  }
] as const;

const MARGIN_CALL_HOOK_ABI = [
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
    "type": "event",
    "name": "MarginCallTriggered",
    "inputs": [
      {"name": "user", "type": "address", "indexed": true},
      {"name": "collateralValue", "type": "uint256", "indexed": false},
      {"name": "debtValue", "type": "uint256", "indexed": false},
      {"name": "payout", "type": "uint256", "indexed": false},
      {"name": "reason", "type": "string", "indexed": false}
    ]
  }
] as const;