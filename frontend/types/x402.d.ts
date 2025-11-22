// types/x402.d.ts
declare module 'x402-fetch' {
  export function wrapFetchWithPayment(fetch: any, walletClient: any): any;
}

declare module 'x402-express' {
  export function paymentMiddleware(platformWallet: string, pricingRules: any, facilitator: any): any;
}

declare module '@coinbase/x402' {
  export const facilitator: any;
}