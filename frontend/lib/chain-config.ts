import { sepolia, baseSepolia } from 'viem/chains';

export interface ChainConfig {
  chain: any;
  hookAddress: `0x${string}`;
  pythAddress: `0x${string}`;
  poolManagerAddress: `0x${string}`;
  universalRouterAddress: `0x${string}`;
  stateViewAddress: `0x${string}`;
  riskTokenAddress: `0x${string}`;
  claimVerifierAddress: `0x${string}`;
  secondaryMarketAddress: `0x${string}`;
  name: string;
  testTokens: {
    USDC: `0x${string}`;
    WETH?: `0x${string}`;
  };
  poolConfig: {
    poolId: `0x${string}`;
    fee: number;
    tickSpacing: number;
    currency0: `0x${string}`;
    currency1: `0x${string}`;
    hookAddress: `0x${string}`;
  };
  rpcUrl: string;
}

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  [sepolia.id]: {
    chain: sepolia,
    hookAddress: '0x1C9f149Ab2eb65d1928f5373b91bD5e8E48BCfC0' as `0x${string}`,
    pythAddress: '0xDd24F84d36BF92C65F92307595335bdFab5Bbd21' as `0x${string}`,
    poolManagerAddress: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543' as `0x${string}`,
    universalRouterAddress: '0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b' as `0x${string}`,
    stateViewAddress: '0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c' as `0x${string}`,
    riskTokenAddress: '0xEba681bc4C4e5EdA7Dabace33890947Aa99B98F3' as `0x${string}`,
    claimVerifierAddress: '0x1dDef033109bf61946915A0e32fbDef770beF9D0' as `0x${string}`,
    secondaryMarketAddress: '0xf50323584E39aB218bD369C2Ab73FB95e8907F00' as `0x${string}`,
    name: 'Ethereum Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_ALCHEMY_ETHEREUM_SEPOLIA_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
    testTokens: {
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
      WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`
    },
    poolConfig: {
      poolId: '0x0d871d48de91185eb0636c09724876e0d276318a12681689493f55aab2a945e6' as `0x${string}`,
      fee: 3000,
      tickSpacing: 60,
      currency0: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      currency1: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
      hookAddress: '0x1C9f149Ab2eb65d1928f5373b91bD5e8E48BCfC0' as `0x${string}`
    }
  },
  [baseSepolia.id]: {
    chain: baseSepolia,
    hookAddress: '0x1C9f149Ab2eb65d1928f5373b91bD5e8E48BCfC0' as `0x${string}`,
    pythAddress: '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729' as `0x${string}`,
    poolManagerAddress: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as `0x${string}`,
    universalRouterAddress: '0x492E6456D9528771018DeB9E87ef7750EF184104' as `0x${string}`,
    stateViewAddress: '0x571291b572ed32ce6751a2cb2486ebee8defb9b4' as `0x${string}`,
    riskTokenAddress: '0xAcd7FFd3Bbb6A57E6856655Cb34b17169584486A' as `0x${string}`,
    claimVerifierAddress: '0xca549C806197D7E4C281E490Ce5de54109163467' as `0x${string}`,
    secondaryMarketAddress: '0xb9c5e84B986e6574D34189F6591245c2fe82Ac44' as `0x${string}`,
    name: 'Base Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_ALCHEMY_BASE_SEPOLIA_URL || 'https://base-sepolia.g.alchemy.com/v2/demo',
    testTokens: {
      USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
      WETH: '0x4200000000000000000000000000000000000006' as `0x${string}`
    },
    poolConfig: {
      poolId: '0x25b360222467138d38e81d65aacf5dedb74b0aac7741e01ad0b4fcd5544f2e30' as `0x${string}`,
      fee: 3000,
      tickSpacing: 60,
      currency0: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      currency1: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
      hookAddress: '0x1C9f149Ab2eb65d1928f5373b91bD5e8E48BCfC0' as `0x${string}`
    }
  }
};

export const PYTH_FEED_IDS = {
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace' as `0x${string}`,
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43' as `0x${string}`,
  USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a' as `0x${string}`
} as const;

// Asset name mapping for display
export const ASSET_NAMES: Record<string, string> = {
  [PYTH_FEED_IDS.ETH_USD]: 'ETH',
  [PYTH_FEED_IDS.BTC_USD]: 'BTC', 
  [PYTH_FEED_IDS.USDC_USD]: 'USDC',
};

export const getChainConfig = (chainId: number): ChainConfig | undefined => {
  return CHAIN_CONFIGS[chainId];
};

export const ADMIN_ADDRESSES = [
  '0x2067ca3b10b136a38203723d842418c646c6e393',
  '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  '0xb8e80e03076dc263f1251726395f388cdfc5f523'
];