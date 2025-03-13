import { DefaultResponse, CrossoverResponse } from "./interfaces/responses";
import ccxt, { bybit, OHLCV } from "ccxt";
import { placeLongOrder, stopLongOrder } from "./orderFunctions";

const exchange = new ccxt.bybit();

export async function calculateSMA(tradingPair: string, periods: number, timeframe: string): Promise<DefaultResponse> {
    // Timeframe (e.g., 1h, 1d, 1w)
    //OHLCV - (Open, High, Low, Close, Volume) - used to get historicial data

    try {
        // Initialize the exchange
        const exchange = new ccxt.bybit();

        // Fetch OHLCV data (candlestick data)
        const ohlcv = await exchange.fetchOHLCV(tradingPair, timeframe);

        // Making sure we have enough data for the given period
        if (ohlcv.length < periods) {
            throw new Error(`Not enough data. Required: ${periods}, Available: ${ohlcv.length}`);
        }

        // Extract closing prices (index 4 in OHLCV data)
        const closingPrices = ohlcv.slice(-periods).map((candle: any) => candle[4]);

        // Sum the closing prices
        const sumOfClosingPrices = closingPrices.reduce((acc: number, price: number) => acc + price, 0);

        const sma = sumOfClosingPrices / periods

        return {isSuccessful: true, message: "Successfully calculated SMA.", data: sma};
    } catch (error: any) {
        return {isSuccessful: true, message: "Failed to calculate SMA: " + error.message, data: null}
    }
}

export async function calculateEMA(tradingPair: string, periods: number, timeframe: string) {
    try {
        // Initialize the exchange
        const exchange = new ccxt.bybit();

        let since = exchange.milliseconds() - 500 * exchange.parseTimeframe(timeframe) * 1000;

        // Fetch OHLCV data (candlestick data)
        const ohlcv = await exchange.fetchOHLCV(tradingPair, timeframe, since, 500);

        // // Debug: Log the number of candles fetched
        // console.log(`\tFetched ${ohlcv.length} candles for ${tradingPair} (${timeframe})`);

        // Validate OHLCV data
        if (!ohlcv || ohlcv.length === 0) {
            throw new Error('\tNo OHLCV data found.');
        }

        // Ensure we have enough data for the given period
        if (ohlcv.length < periods) {
            throw new Error(`\tNot enough data. Required: ${periods}, Available: ${ohlcv.length}`);
        }

        // Extract closing prices (index 4 in OHLCV data)
        const closingPrices = ohlcv.map((candle: any) => candle[4]);

        // // Debug: Log the first and last closing prices
        // console.log(`\tFirst closing price: ${closingPrices[0]}`);
        // console.log(`\tLast closing price: ${closingPrices[closingPrices.length - 1]}`);

        // Calculate the smoothing factor (k)
        const k = 2 / (periods + 1);

        // Calculate the SMA for the first period (initial EMA value)
        let sma = 0;
        for (let i = 0; i < periods; i++) {
            sma += closingPrices[i];
        }
        sma /= periods;

        // // Debug: Log the initial SMA
        // console.log(`\tInitial SMA (first ${periods} periods): ${sma}`);

        // Calculate the EMA for subsequent periods
        const emaValues = [sma]; // Initialize with the SMA
        for (let i = periods; i < closingPrices.length; i++) {
            const ema = (closingPrices[i] * k) + (emaValues[emaValues.length - 1] * (1 - k));
            emaValues.push(ema);
        }

        // // Debug: Log the number of EMA values calculated
        // console.log(`\tCalculated ${emaValues.length} EMA values\n`);

        return { isSuccessful: true, message: "Successfully calculated EMA.", data: emaValues };
    } catch (error: any) {
        return { isSuccessful: false, message: error.message, data: null };
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
