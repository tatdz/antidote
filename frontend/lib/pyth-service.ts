import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { PYTH_FEED_IDS } from './chain-config';

export interface PriceUpdate {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

export class PythService {
  private connection: EvmPriceServiceConnection;
  
  constructor() {
    this.connection = new EvmPriceServiceConnection("https://hermes.pyth.network");
  }

  async getPriceUpdateData(feedIds: string[]): Promise<`0x${string}`[]> {
    try {
      console.log('Fetching price update data for feeds:', feedIds);
      const updateData = await this.connection.getPriceFeedsUpdateData(feedIds);
      
      console.log('Received price update data with length:', updateData.length);
      return updateData as `0x${string}`[];
    } catch (error: any) {
      console.error('Failed to fetch price update data from Pyth:', error);
      throw new Error(`Failed to fetch price data: ${error.message}`);
    }
  }

async getLatestPrices(feedIds: string[]) {
  try {
    console.log('Fetching latest prices for feeds:', feedIds);
    const priceFeeds = await this.connection.getLatestPriceFeeds(feedIds);
    const prices: Record<string, any> = {};

    if (priceFeeds) {
      for (const priceFeed of priceFeeds) {
        const price = priceFeed.getPriceUnchecked();
        
        console.log(`Raw price data for ${priceFeed.id}:`, {
          price: price.price.toString(),
          expo: price.expo,
          conf: price.conf.toString()
        });

        // More robust price conversion
        // Pyth prices are typically: price * 10^expo
        const rawPrice = BigInt(price.price);
        const exponent = price.expo;
        
        let priceNumber: number;
        if (exponent >= 0) {
          priceNumber = Number(rawPrice) * Math.pow(10, exponent);
        } else {
          priceNumber = Number(rawPrice) / Math.pow(10, -exponent);
        }

        // For USD pairs, we expect reasonable values (not 0.000034)
        // If the price seems too small, try alternative conversion
        if (priceNumber < 1 && priceFeed.id.includes('USD')) {
          console.warn(`Price seems too small for ${priceFeed.id}, trying alternative conversion`);
          // Alternative: treat as fixed-point with 8 decimals
          priceNumber = Number(rawPrice) / 1e8;
        }

        let confidence: number;
        const rawConfidence = BigInt(price.conf);
        if (exponent >= 0) {
          confidence = Number(rawConfidence) * Math.pow(10, exponent);
        } else {
          confidence = Number(rawConfidence) / Math.pow(10, -exponent);
        }

        if (confidence < 1 && priceFeed.id.includes('USD')) {
          confidence = Number(rawConfidence) / 1e8;
        }

        prices[priceFeed.id] = {
          price: priceNumber,
          confidence,
          publishTime: price.publishTime,
          expo: price.expo,
          rawPrice: price.price,
          rawConfidence: price.conf
        };

        console.log(`Final price for ${priceFeed.id}: $${priceNumber} ± $${confidence}`);
      }
    }

    return prices;
  } catch (error: any) {
    console.error('Failed to fetch latest prices from Pyth:', error);
    throw new Error(`Failed to fetch prices: ${error.message}`);
  }
}



async getUpdateFee(feedIds: string[]): Promise<bigint> {
  try {
    // More realistic fee calculation for testnet
    const baseFee = BigInt(100000); // 100,000 gas base
    const perFeedFee = BigInt(50000); // 50,000 gas per feed
    const estimatedGas = baseFee + (BigInt(feedIds.length) * perFeedFee);
    const gasPrice = BigInt(25000000000); // 25 gwei for testnet
    return estimatedGas * gasPrice;
  } catch (error) {
    console.error('Failed to estimate update fee:', error);
    return BigInt(1000000000000000); // 0.001 ETH fallback
  }
}
}

export const pythService = new PythService();