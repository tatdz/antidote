// lib/ipfs-storage.ts
export interface IPFSStorageResult {
  cid: string;
  gatewayUrl: string;
  size: number;
}

export class IPFSStorage {
  static async storeData(data: any): Promise<IPFSStorageResult> {
    try {
      console.log('📦 Storing data on IPFS...');
      
      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `IPFS upload failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'IPFS upload failed');
      }

      console.log('✅ Data stored on IPFS:', result.cid);
      
      return {
        cid: result.cid,
        gatewayUrl: result.gatewayUrl,
        size: result.size
      };
      
    } catch (error) {
      console.error('IPFS storage error:', error);
      throw new Error(`IPFS storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}