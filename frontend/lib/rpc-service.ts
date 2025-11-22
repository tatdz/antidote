// lib/rpc-service.ts
export class RpcService {
  static async callRpc(method: string, params: any[], chain: 'sepolia' | 'baseSepolia' = 'sepolia') {
    try {
      const response = await fetch('/api/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          params,
          chain,
        }),
      });

      if (!response.ok) {
        throw new Error(`RPC call failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      console.error('RPC call failed:', error);
      throw error;
    }
  }

  static getChainFromId(chainId: number): 'sepolia' | 'baseSepolia' {
    return chainId === 11155111 ? 'sepolia' : 'baseSepolia';
  }
}