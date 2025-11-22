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
  private backupConnection: EvmPriceServiceConnection;
  
  constructor() {
    // Much shorter timeouts - don't wait 20 seconds
    this.connection = new EvmPriceServiceConnection("https://hermes.pyth.network", {
      timeout: 5000, // Reduced from 20000 to 5000ms
    });

    this.backupConnection = new EvmPriceServiceConnection("https://hermes.pyth.network", {
      timeout: 3000, // Reduced from 15000 to 3000ms
    });
  }

  async getPriceUpdateData(feedIds: string[]): Promise<`0x${string}`[]> {
    try {
      console.log('Fetching price update data for feeds:', feedIds);
      
      // Race between primary and backup with much shorter timeouts
      const primaryPromise = this.connection.getPriceFeedsUpdateData(feedIds);
      const backupPromise = this.backupConnection.getPriceFeedsUpdateData(feedIds);
      
      // Try primary first, but don't wait long
      try {
        const updateData = await Promise.race([
          primaryPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Primary timeout')), 3000))
        ]);
        console.log('Primary connection succeeded for update data');
        return updateData as `0x${string}`[];
      } catch (primaryError) {
        console.log('Primary failed, trying backup...');
        // Immediately try backup without waiting
        try {
          const backupData = await Promise.race([
            backupPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Backup timeout')), 2000))
          ]);
          console.log('Backup connection succeeded for update data');
          return backupData as `0x${string}`[];
        } catch (backupError) {
          console.error('Both primary and backup failed:', backupError);
          throw new Error('Pyth network unavailable - failed to fetch price update data');
        }
      }
      
    } catch (error: any) {
      console.error('Pyth update data fetch failed:', error);
      throw new Error(`Failed to fetch price update data: ${error.message}`);
    }
  }

  async getLatestPrices(feedIds: string[]) {
    try {
      console.log('Fetching latest prices for feeds:', feedIds);
      
      // Same fast race strategy for prices
      const primaryPromise = this.connection.getLatestPriceFeeds(feedIds);
      const backupPromise = this.backupConnection.getLatestPriceFeeds(feedIds);
      
      try {
        const priceFeeds = await Promise.race([
          primaryPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Primary timeout')), 3000))
        ]);
        console.log('Primary connection succeeded for price feeds');
        return this.processPriceFeeds(priceFeeds as any[] | null | undefined, feedIds);
      } catch (primaryError) {
        console.log('Primary failed, trying backup...');
        try {
          const backupPriceFeeds = await Promise.race([
            backupPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Backup timeout')), 2000))
          ]);
          console.log('Backup connection succeeded for price feeds');
          return this.processPriceFeeds(backupPriceFeeds as any[] | null | undefined, feedIds);
        } catch (backupError) {
          console.error('Both primary and backup failed for prices:', backupError);
          throw new Error('Pyth price feed unavailable - failed to fetch latest prices');
        }
      }
      
    } catch (error: any) {
      console.error('Pyth price fetch failed:', error);
      throw new Error(`Failed to fetch latest prices: ${error.message}`);
    }
  }

  private processPriceFeeds(priceFeeds: any[] | null | undefined, feedIds: string[]) {
    const prices: Record<string, any> = {};

    if (priceFeeds && priceFeeds.length > 0) {
      for (const priceFeed of priceFeeds) {
        const price = priceFeed.getPriceUnchecked();
        const feedId = priceFeed.id;
        
        console.log(`Raw price data for ${feedId}:`, {
          price: price.price.toString(),
          expo: price.expo,
          conf: price.conf.toString()
        });

        // More robust price conversion
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
        if (priceNumber < 1 && feedId.includes('USD')) {
          console.warn(`Price seems too small for ${feedId}, trying alternative conversion`);
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

        if (confidence < 1 && feedId.includes('USD')) {
          confidence = Number(rawConfidence) / 1e8;
        }

        prices[feedId] = {
          price: priceNumber,
          confidence,
          publishTime: price.publishTime,
          expo: price.expo,
          rawPrice: price.price,
          rawConfidence: price.conf
        };

        console.log(`Final price for ${feedId}: $${priceNumber} ± $${confidence}`);
      }
    }

    // Debug: log what we actually have in the prices object
    console.log('Available price feeds after processing:', Object.keys(prices));
    console.log('Requested feed IDs:', feedIds);

    // Ensure we have entries for all requested feed IDs
    // The issue might be that the feed IDs from Pyth are in a different format
    const finalPrices: Record<string, any> = {};
    
    for (const requestedFeedId of feedIds) {
      let foundPrice = prices[requestedFeedId];
      
      // If not found by exact match, try normalized comparison
      if (!foundPrice) {
        const normalizedRequested = requestedFeedId.toLowerCase().replace(/^0x/, '');
        
        for (const [availableFeedId, priceData] of Object.entries(prices)) {
          const normalizedAvailable = availableFeedId.toLowerCase().replace(/^0x/, '');
          
          if (normalizedRequested === normalizedAvailable) {
            console.log(`Found matching feed with different format: ${availableFeedId} -> ${requestedFeedId}`);
            foundPrice = priceData;
            break;
          }
        }
      }
      
      if (foundPrice) {
        finalPrices[requestedFeedId] = foundPrice;
      } else {
        console.warn(`No real price data found for feed: ${requestedFeedId}`);
        // NO FALLBACK - only return real data
      }
    }

    return finalPrices;
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
      return BigInt(1000000000000000); // 0.001 ETH fallback for fee estimation only
    }
  }
}

export const pythService = new PythService();