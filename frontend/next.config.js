/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  
  transpilePackages: [
    'x402-fetch',
    'x402-next',
    '@coinbase/x402',
    '@coinbase/cdp-facilitator',
  ],
  
  trailingSlash: false,
  
  images: {
    domains: [
      'assets.coinbase.com',
      'static.wikia.nocookie.net',
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Payment, X-User-Address, X-Payment-Verified' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;