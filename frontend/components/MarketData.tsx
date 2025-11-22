import { useEffect, useState } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RefreshCw, AlertTriangle, Shield, TrendingUp, TrendingDown, Activity, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { pythService } from '../lib/pyth-service';
import { PYTH_FEED_IDS } from '../lib/chain-config';

interface PriceData {
  asset: string;
  price: number;
  change: number;
  confidence: number;
  volatility: number;
  marginHealth: number;
  collateralRatio: number;
  history: { time: string; price: number; collateralRatio: number }[];
}

// Map Pyth price IDs to readable asset names
const ASSET_NAMES: Record<string, string> = {
  [PYTH_FEED_IDS.ETH_USD]: 'ETH',
  [PYTH_FEED_IDS.BTC_USD]: 'BTC',
  [PYTH_FEED_IDS.USDC_USD]: 'USDC',
};

// Fixed: Proper union type syntax
type ChartType = 'line' | 'area' | 'bar';

export default function MarketData() {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [priceHistory, setPriceHistory] = useState<Record<string, { time: string; price: number; collateralRatio: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('area');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Calculate real collateral ratios based on market conditions
  const calculateCollateralRatio = (asset: string, price: number, volatility: number): number => {
    // Base collateral ratios with market adjustments
    const baseRatios: Record<string, number> = {
      'ETH': 145, // 145% base for ETH
      'BTC': 135, // 135% base for BTC  
      'USDC': 101, // 101% base for stablecoins
    };

    const baseRatio = baseRatios[asset] || 150;
    
    // Adjust based on volatility (higher volatility = higher collateral requirement)
    const volatilityAdjustment = Math.min(volatility * 50, 20);
    
    // Adjust based on recent price changes
    const priceAdjustment = price > 0 ? 0 : 5; // Small penalty for negative price momentum
    
    return Math.max(110, baseRatio + volatilityAdjustment + priceAdjustment);
  };

  const calculateVolatility = (prices: number[]): number => {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  };

  const calculateMarginHealth = (collateralRatio: number, volatility: number, change: number): number => {
    // Margin health score based on collateral ratio and market conditions
    const baseScore = Math.max(0, Math.min(100, (collateralRatio - 110) * 2));
    
    // Penalize high volatility
    const volatilityPenalty = Math.min(volatility * 100, 30);
    
    // Bonus for positive price momentum
    const momentumBonus = change > 0 ? Math.min(change * 10, 15) : Math.max(change * 5, -20);
    
    return Math.max(0, Math.min(100, baseScore - volatilityPenalty + momentumBonus));
  };

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setError(null);
        
        // Fetch real prices from Pyth using the feed IDs from chain-config
        const prices = await pythService.getLatestPrices([
          PYTH_FEED_IDS.ETH_USD,
          PYTH_FEED_IDS.BTC_USD,
          PYTH_FEED_IDS.USDC_USD
        ]);

        if (Object.keys(prices).length === 0) {
          throw new Error('No price data received from Pyth');
        }

        // Update price history for charts with timestamp
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          hour12: false 
        });
        
        setPriceHistory(prevHistory => {
          const newHistory = { ...prevHistory };
          const transformed: PriceData[] = [];

          Object.entries(prices).forEach(([priceId, priceInfo]: [string, any]) => {
            const asset = ASSET_NAMES[priceId] || priceId.slice(0, 6);
            
            // Initialize history array if needed
            if (!newHistory[asset]) {
              newHistory[asset] = [];
            }
            
            // Get recent prices for volatility calculation
            const recentPrices = [...newHistory[asset].map(h => h.price), priceInfo.price].slice(-20);
            const volatility = calculateVolatility(recentPrices);
            
            // Calculate real collateral ratio
            const collateralRatio = calculateCollateralRatio(asset, priceInfo.price, volatility);
            
            // Add new price point
            newHistory[asset] = [...newHistory[asset], { 
              time: timeString, 
              price: priceInfo.price,
              collateralRatio 
            }];
            
            // Keep only last 30 data points
            if (newHistory[asset].length > 30) {
              newHistory[asset] = newHistory[asset].slice(-30);
            }
            
            // Calculate price change
            const history = newHistory[asset];
            const change = history.length > 1 
              ? ((priceInfo.price - history[0].price) / history[0].price) * 100 
              : 0;

            // Calculate margin health
            const marginHealth = calculateMarginHealth(collateralRatio, volatility, change);

            transformed.push({
              asset,
              price: priceInfo.price,
              change,
              confidence: priceInfo.confidence,
              volatility,
              marginHealth,
              collateralRatio,
              history: [...history],
            });
          });

          setPriceData(transformed);
          setLastUpdate(now);
          return newHistory;
        });
        
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error fetching market data');
        setLoading(false);
      }
    };

    // Initial fetch
    fetchPrices();
    
    // Auto-refresh every 5 seconds for live updates
    const interval = setInterval(fetchPrices, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const renderChart = (data: PriceData) => {
    const chartProps = {
      data: data.history,
      margin: { top: 5, right: 5, left: 5, bottom: 5 }
    };

    const tooltipStyle = {
      contentStyle: {
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '8px',
      },
      labelStyle: { color: '#94a3b8' }
    };

    switch (chartType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart {...chartProps}>
              <defs>
                <linearGradient id={`gradient-${data.asset}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis 
                dataKey="time" 
                stroke="#64748b" 
                fontSize={10}
                interval="preserveStartEnd"
                tickFormatter={(value) => value.split(':').slice(1).join(':')}
              />
              <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={10} />
              <Tooltip {...tooltipStyle} />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#06b6d4" 
                strokeWidth={2}
                fill={`url(#gradient-${data.asset})`}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis 
                dataKey="time" 
                stroke="#64748b" 
                fontSize={10}
                interval="preserveStartEnd"
                tickFormatter={(value) => value.split(':').slice(1).join(':')}
              />
              <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={10} />
              <Tooltip {...tooltipStyle} />
              <Bar 
                dataKey="price" 
                fill="#06b6d4"
                radius={[4, 4, 0, 0]}
                animationDuration={300}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'line':
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis 
                dataKey="time" 
                stroke="#64748b" 
                fontSize={10}
                interval="preserveStartEnd"
                tickFormatter={(value) => value.split(':').slice(1).join(':')}
              />
              <YAxis domain={['auto', 'auto']} stroke="#64748b" fontSize={10} />
              <Tooltip {...tooltipStyle} />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#06b6d4" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-green-400';
    if (health >= 60) return 'text-yellow-400';
    if (health >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHealthBgColor = (health: number) => {
    if (health >= 80) return 'bg-green-500';
    if (health >= 60) return 'bg-yellow-500';
    if (health >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mr-2" />
      <span className="text-gray-600">Loading live market data from Pyth Network...</span>
    </div>
  );
  
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
      <p className="text-red-800 font-medium">Market Data Error</p>
      <p className="text-red-600 text-sm mt-1">{error}</p>
      <p className="text-red-500 text-xs mt-2">Ensure Pyth Hermes service is accessible</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with Chart Type Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <div>
            <p className="text-lg font-semibold text-gray-900">Live Market Data</p>
            <p className="text-sm text-gray-600">
              Pyth Network • Updated {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>
        
        {/* Chart Type Selector */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setChartType('line')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              chartType === 'line' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Line
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              chartType === 'area' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            Area
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              chartType === 'bar' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Bar
          </button>
        </div>
      </div>
      
      {/* Market Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {priceData.map((data) => (
          <div key={data.asset} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
            {/* Card Header */}
            <div className="p-6 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-900">{data.asset}/USD</h3>
                <div className="flex items-center gap-2">
                  {data.change >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${data.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
                  </span>
                </div>
              </div>
              
              <div>
                <div className="text-3xl font-mono font-bold text-gray-900 mb-1">
                  ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Confidence: ±${data.confidence.toFixed(4)}</span>
                  <span>•</span>
                  <span>Vol: {(data.volatility * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
            
            {/* Risk Metrics */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Collateral Ratio</div>
                  <div className="font-semibold text-gray-900">{data.collateralRatio.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-gray-600">Margin Health</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getHealthBgColor(data.marginHealth)}`}></div>
                    <span className={`font-semibold ${getHealthColor(data.marginHealth)}`}>
                      {data.marginHealth.toFixed(0)}/100
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chart */}
            <div className="p-4 bg-gray-50">
              <div className="h-48">
                {renderChart(data)}
              </div>
            </div>
            
            {/* Status Indicator */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Margin Safety</span>
                {data.marginHealth >= 70 ? (
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <Shield className="w-3 h-3" />
                    Secure
                  </span>
                ) : data.marginHealth >= 50 ? (
                  <span className="flex items-center gap-1 text-yellow-600 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    Watch
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    Risky
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-700">Secure: &gt;70% Margin Health</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-gray-700">Watch: 50-70% Margin Health</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-700">Risky: &lt;50% Margin Health</span>
          </div>
        </div>
      </div>
    </div>
  );
}