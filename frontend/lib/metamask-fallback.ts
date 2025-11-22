// lib/metamask-fallback.ts
export const metamaskFallback = {
  // This provides a fallback for the missing async-storage dependency
  isMetaMask: true,
  request: async (args: any) => {
    if (window.ethereum) {
      return window.ethereum.request(args);
    }
    throw new Error('MetaMask not available');
  }
};