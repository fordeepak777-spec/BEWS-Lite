
/**
 * BEWS Trade Engine v1
 * Independent, read-only market assessment.
 * No exchange connections, no order execution.
 */

export type BewsDirection = 'LONG' | 'SHORT' | 'NO TRADE';

export interface BewsResult {
  direction: BewsDirection;
  entry: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  riskReward: number | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  timeframe: string;
  price: number | null;
  rsi: number | null;
  ema20: number | null;
  ema50: number | null;
  vwapProxy: number | null;
  reason: string;
  timestamp: number;
}

type Candle = [
  number, number, number, number, number, number
];

interface BewsMarketState {
  mark: { price: number; asOf: number };
  candles: Candle[];
  timeframe: string;
  candlesTimeframe?: string;
}

const ema = (values: number[], period: number): number | null => {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let result = values.slice(0, period)
    .reduce((a, b) => a + b, 0) / period;

  for (const value of values.slice(period)) {
    result = value * k + result * (1 - k);
  }
  return result;
};

const calculateRSI = (values: number[]): number | null => {
  if (values.length < 15) return null;

  let gains = 0;
  let losses = 0;

  for (let i = values.length - 14; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  if (losses === 0) return gains === 0 ? 50 : 100;

  return 100 - 100 / (1 + gains / losses);
};

const calculateATR = (candles: Candle[]): number | null => {
  if (candles.length < 15) return null;

  const ranges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i][2];
    const low = candles[i][3];
    const previousClose = candles[i - 1][4];

    ranges.push(Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose)
    ));
  }

  const recent = ranges.slice(-14);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
};

const calculateVWAPProxy = (candles: Candle[]): number | null => {
  const recent = candles.slice(-20);
  let totalVolume = 0;
  let totalValue = 0;

  for (const candle of recent) {
    const typicalPrice = (candle[2] + candle[3] + candle[4]) / 3;
    const volume = candle[5];

    if (volume > 0) {
      totalValue += typicalPrice * volume;
      totalVolume += volume;
    }
  }

  return totalVolume > 0 ? totalValue / totalVolume : null;
};

const roundPrice = (price: number): number =>
  Number(price.toPrecision(8));

export function analyzeBews(
  state: BewsMarketState
): BewsResult {
  const candles = state.candles || [];
  const closes = candles.map(c => c[4]);
  const price = state.mark?.price || null;

  const result: BewsResult = {
    direction: 'NO TRADE',
    entry: null,
    stopLoss: null,
    target1: null,
    target2: null,
    riskReward: null,
    confidence: 'LOW',
    timeframe: state.timeframe,
    price,
    rsi: null,
    ema20: null,
    ema50: null,
    vwapProxy: null,
    reason: 'Insufficient market data.',
    timestamp: Date.now()
  };

  if (
    !price ||
    !Number.isFinite(price) ||
    candles.length < 55 ||
    (state.candlesTimeframe &&
      state.candlesTimeframe !== state.timeframe)
  ) {
    return result;
  }

  if (candles.some(c =>
    !Number.isFinite(c[2]) ||
    !Number.isFinite(c[3]) ||
    !Number.isFinite(c[4]) ||
    !Number.isFinite(c[5])
  )) {
    result.reason = 'Invalid candle data.';
    return result;
  }

  const fastEMA = ema(closes, 20);
  const slowEMA = ema(closes, 50);
  const rsi = calculateRSI(closes);
  const atr = calculateATR(candles);
  const vwap = calculateVWAPProxy(candles);
  const lastClose = closes[closes.length - 1];

  result.ema20 = fastEMA;
  result.ema50 = slowEMA;
  result.rsi = rsi;
  result.vwapProxy = vwap;

  if (
    fastEMA === null ||
    slowEMA === null ||
    rsi === null ||
    atr === null ||
    vwap === null ||
    atr <= 0
  ) {
    result.reason = 'Indicators could not be calculated.';
    return result;
  }

  const longTrend = fastEMA > slowEMA;
  const shortTrend = fastEMA < slowEMA;

  const longMomentum =
    lastClose > fastEMA && rsi >= 50 && rsi <= 68;

  const shortMomentum =
    lastClose < fastEMA && rsi <= 50 && rsi >= 32;

  const longVWAP = lastClose > vwap;
  const shortVWAP = lastClose < vwap;

  let direction: BewsDirection = 'NO TRADE';
  let score = 0;

  if (longTrend && longMomentum && longVWAP) {
    direction = 'LONG';
    score = 3;
  } else if (shortTrend && shortMomentum && shortVWAP) {
    direction = 'SHORT';
    score = 3;
  }

  if (direction === 'NO TRADE') {
    result.reason =
      'No aligned trend, momentum and VWAP conditions. Wait for a better setup.';
    return result;
  }

  const entry = price;
  const risk = atr * 1.2;

  const stop = direction === 'LONG'
    ? entry - risk
    : entry + risk;

  const target1 = direction === 'LONG'
    ? entry + risk * 3
    : entry - risk * 3;

  const target2 = direction === 'LONG'
    ? entry + risk * 4.5
    : entry - risk * 4.5;

  result.direction = direction;
  result.entry = roundPrice(entry);
  result.stopLoss = roundPrice(stop);
  result.target1 = roundPrice(target1);
  result.target2 = roundPrice(target2);
  result.riskReward = 3;
  result.confidence = 'MEDIUM';
  result.reason =
    'Trend, momentum and rolling VWAP proxy are aligned. ATR-based illustrative setup; confirmation required.';

  return result;
}
