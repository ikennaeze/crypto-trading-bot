import { DefaultResponse, CrossoverResponse } from "./interfaces/responses";
import ccxt, { bybit, OHLCV } from "ccxt";
import { placeLongOrder, placeShortOrder } from "./orderFunctions";
import { EMA, RSI } from "technicalindicators";

import { KlineIntervalV3, RestClientV5 } from 'bybit-api';
import * as dotenv from 'dotenv';
import { getAvailableBalance } from "./userData";

dotenv.config(); // Load environment variables

const apiKey = process.env.BYBIT_API_KEY || "";
const apiSecret = process.env.BYBIT_API_SECRET || "";

if (!apiKey || !apiSecret) {
  throw new Error('BYBIT_API_KEY and BYBIT_API_SECRET must be set in the environment variables.');
}

const client = new RestClientV5({
  key: apiKey,
  secret: apiSecret,
  testnet: false,
});


export async function fetchCurrentPrice(tradingPair: string): Promise<DefaultResponse>{
    try {
        const exchange = new ccxt.bybit()
        const ticker = await exchange.fetchTicker(tradingPair)
        const currentPrice = await ticker.last
        return {isSuccessful: true, message: "\tBitcoin's current price in USDT is:", data: currentPrice}
    } catch (error: any) {
        return {isSuccessful: false, message: "\tInternal server error from fetching current price:\n\t" + error.message, data: null}
    }
}

export async function convertBaseCoinToQuoteCoin(tradingPair: string, baseCoinAmt: number): Promise<number>{
    const baseCoinCurrentPrice = await fetchCurrentPrice(tradingPair)
    const baseCoinToQuoteCoin = Number(baseCoinCurrentPrice.data) * baseCoinAmt
    return baseCoinToQuoteCoin
}

export async function fetchHistoricalData(tradingPair: string, periods: number, timeframe: string): Promise<DefaultResponse> {
    // Timeframe (e.g., 1h, 1d, 1w)
    //OHLCV - (Open, High, Low, Close, Volume) - used to get historicial data

    try {
        // Initialize the exchange
        const exchange = new ccxt.bybit();

        // Fetch OHLCV data (candlestick data)
        const ohlcv = await exchange.fetchOHLCV(tradingPair, timeframe);

        // Validate OHLCV data
        if (!ohlcv || ohlcv.length === 0) {
            return {isSuccessful: false, message: '\tNo OHLCV data found.', data: null };
        }

        // Ensure we have enough data for the given period
        if (ohlcv.length < periods) {
            return {isSuccessful: false, message: `\tNot enough data. Required: ${periods}, Available: ${ohlcv.length}`, data: null };
        }

        return {isSuccessful: true, message: "Successfully calculated SMA.", data: ohlcv};
    } catch (error: any) {
        return {isSuccessful: true, message: "Failed to calculate SMA: " + error.message, data: null}
    }
}

export async function fetchKline(tradingPair: string, timeframe: KlineIntervalV3, limit: number) {
    const response = await client.getKline({
        category: 'spot',
        symbol: tradingPair,
        interval: timeframe,
        limit: limit,
    });
    return response.result.list.map(candle => ({
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
    }));
}
export function fetchClosingPrices(ohlcv: OHLCV[]){
    if (!ohlcv || !Array.isArray(ohlcv)) {
        console.error("Error: OHLCV data is null, undefined, or not an array:", ohlcv);
        return []; // Return an empty array or handle the error appropriately
    }
    
    // Extract closing prices (index 4 in OHLCV data)
    const closingPrices = ohlcv.map((candle: any) => candle[4]);
    return closingPrices
}

export function calculateEMA(EMAPeriod: number, closingPrices: any[]): number[]{
    const emaValues = EMA.calculate({period: EMAPeriod, values: closingPrices})
    // // Debug Logs: 
    // console.log(`\tEMA: ${emaValues}\n`)
    return emaValues
}

export function calculateRSI(RSIPeriod: number, closingPrices: any[]): number[]{
    const rsiValues = RSI.calculate({period: RSIPeriod, values: closingPrices})
    // // Debug: Log the number of EMA values calculated
    // console.log(`\tRSI: $rsiValues} \n`)
    return rsiValues
}

export function calculateATR(data: { high: number; low: number; close: number }[], period: number) {
    const trueRanges: number[] = [];

    for (let i = 1; i < data.length; i++) {
        const currentHigh = data[i].high;
        const currentLow = data[i].low;
        const previousClose = data[i - 1].close;

        const trueRange = Math.max(
            currentHigh - currentLow,
            Math.abs(currentHigh - previousClose),
            Math.abs(currentLow - previousClose)
        );
        trueRanges.push(trueRange);
    }

    // Calculate the ATR as the average of the true ranges
    const atr = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    return atr;
}

export async function calculatePositionSize(coinBalance: number, tradingPair: string, riskPerTrade: number, multiplier: number, period: number) {
    try {
        // Fetch historical data
        const data = await fetchKline(tradingPair, '1', period + 1); // 1-minute timeframe

        // Calculate ATR
        const atr = calculateATR(data, period);

        // Calculate position size
        const positionSize = (coinBalance * (riskPerTrade / 100)) / (atr * multiplier);

        return positionSize;
    } catch (error) {
        console.error('Error calculating position size:', error);
        throw error;
    }
}

export function searchForCrossover(shortEMA: number[], longEMA: number[]): CrossoverResponse  {

    console.log('\n > Searching for Crossovers... \n');

    // Ensure there are at least 2 data points in both arrays
    if (shortEMA.length < 2 || longEMA.length < 2) {
        console.log("\tInsufficient data to check for crossover.");
    }

    // Get the last two values from both arrays
    const shortPrev = shortEMA[shortEMA.length - 2];
    const shortCurr = shortEMA[shortEMA.length - 1];
    const longPrev = longEMA[longEMA.length - 2];
    const longCurr = longEMA[longEMA.length - 1];

    // Calculate differences
    const prevDiff = shortPrev - longPrev;
    const currDiff = shortCurr - longCurr;

    // Debug logs
    console.log(`\tShort-term EMA: Previous = ${shortPrev}, Current = ${shortCurr}`);
    console.log(`\tLong-term EMA: Previous = ${longPrev}, Current = ${longCurr}`);
    console.log(`\tDifferences: Previous = ${prevDiff}, Current = ${currDiff} \n`);

    // Check for crossover
    const isGoldenCross = prevDiff < 0 && currDiff > 0; // Short-term crosses above long-term
    const isDeathCross = prevDiff > 0 && currDiff < 0; // Short-term crosses below long-term

    if(isGoldenCross){
        return {isGoldenCross: true, isDeathCross: false}
    } else if (isDeathCross) {
        return {isGoldenCross: false, isDeathCross: true}
    } else {
        return {isGoldenCross: false, isDeathCross: false}
    }
}
