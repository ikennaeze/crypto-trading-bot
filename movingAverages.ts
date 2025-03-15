import { DefaultResponse, CrossoverResponse } from "./interfaces/responses";
import ccxt, { bybit, OHLCV } from "ccxt";
import { placeLongOrder, stopLongOrder } from "./orderFunctions";
import { EMA } from "technicalindicators";

const exchange = new ccxt.bybit();

export async function fetchHistoricalData(tradingPair: string, periods: number, timeframe: string): Promise<DefaultResponse> {
    // Timeframe (e.g., 1h, 1d, 1w)
    //OHLCV - (Open, High, Low, Close, Volume) - used to get historicial data

    try {
        // Initialize the exchange
        const exchange = new ccxt.bybit();

        let since = exchange.milliseconds() - 500 * exchange.parseTimeframe(timeframe) * 1000;

        // Fetch OHLCV data (candlestick data)
        const ohlcv = await exchange.fetchOHLCV(tradingPair, timeframe, since, 500);

        // Validate OHLCV data
        if (!ohlcv || ohlcv.length === 0) {
            return {isSuccessful: false, message: '\t✖ No OHLCV data found.', data: null };
        }

        // Ensure we have enough data for the given period
        if (ohlcv.length < periods) {
            return {isSuccessful: false, message: `\t✖ Not enough data. Required: ${periods}, Available: ${ohlcv.length}`, data: null };
        }

        return {isSuccessful: true, message: "Successfully fetched historical data.", data: ohlcv};
    } catch (error: any) {
        return {isSuccessful: true, message: "\t✖ Failed to fetch historical data: " + error.message, data: null}
    }
}

export function fetchClosingPrices(ohlcv: OHLCV[]){
    if (!ohlcv || !Array.isArray(ohlcv)) {
        console.error("\x1b[31m%s\x1b[0m", "\t✖ Error: OHLCV data is null, undefined, or not an array:", ohlcv);
        return []; // Return an empty array or handle the error appropriately
    }
    
    // Extract closing prices (index 4 in OHLCV data)
    const closingPrices = ohlcv.map((candle: any) => candle[4]);
    return closingPrices
}

export async function calculateEMA(tradingPair: string, EMAPeriod: number, timeframe: string): Promise<DefaultResponse>{
    try {
        const ohlcvResponse = await fetchHistoricalData(tradingPair, EMAPeriod, timeframe)

        if(ohlcvResponse.isSuccessful){
            const closingPrices = fetchClosingPrices(ohlcvResponse.data)
            const emaValues = EMA.calculate({period: EMAPeriod, values: closingPrices})
            // // Debug Logs: 
            // console.log(`\tEMA: ${emaValues}\n`)
            return {isSuccessful: true, message: "", data: emaValues}
        } else {
            return {isSuccessful: false, message: ohlcvResponse.message, data: null}
        }
    } catch (error: any) {
        return {isSuccessful: false, message: error.message, data: null}
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
