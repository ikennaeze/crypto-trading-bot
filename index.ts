import { DefaultResponse } from "./interfaces/responses";
import { calculateATR, calculateEMA, calculatePositionSize, calculateRSI, convertBaseCoinToQuoteCoin, fetchClosingPrices, fetchHistoricalData, fetchKline } from "./priceData";
import { getTradingRules, placeBuyOrder, placeSellOrder } from "./orderFunctions";
import { testApiConnection } from "./test-functions/testApiConnection";
import { config } from "./config"
import { getTrueMinSellQtyByTestOrder } from "./test-functions/testSellOrder";
import { getAvailableBalance } from "./userData";

// Constants
const GREEN_TEXT = "\x1b[32m%s\x1b[0m";
const RED_TEXT = "\x1b[31m%s\x1b[0m";
const baseCoin = config.tradingPair.split('/')[0]
const quoteCoin = config.tradingPair.split('/')[1]

enum TradeAction {
    BUY = "BUY",
    SELL = "SELL",
}

// Bot Initialization
async function runBot() {
    console.log('___________________________________\n');
    console.log('Booting up trading bot...\n');

    // Test API Connection
    console.log(" > Testing API Connection...");
    const testConnectionData = await testApiConnection();
    console.log(testConnectionData.message);

    if (!testConnectionData.isSuccessful) {
        console.log(RED_TEXT, "\n(︶︹︶) Trading bot failed to boot. Please try again later.");
        return;
    }

    console.log(GREEN_TEXT, "\nヽ(•‿•)ノ Trading bot is ready to trade!");
    console.log('___________________________________\n');

    // Start Trading
    async function executeTrade() {
        console.log('___________________________________\n');
        console.log('Commencing trade sequence... \n');

        // Fetch Data
        console.log('\n > Fetching Data... \n');
        const ohclvResponse = await fetchHistoricalData(config.tradingPair, config.shortTermEMAPeriod, config.timeframe);
        const klineResponse = await fetchKline(config.tradingPair.replace('/', ''), '1', config.ATRPeriod + 1)

        if (!ohclvResponse.isSuccessful) {
            console.log(RED_TEXT, `\t✖ Failed to fetch historical data, here's why: ${ohclvResponse.message}`);
            return;
        }

        const closingPrices = fetchClosingPrices(ohclvResponse.data);
        const latestClosingPrice = closingPrices[closingPrices.length - 1];
        console.log(GREEN_TEXT, "\t✔ Successfully fetched historical data and closing prices");

        // Calculate EMAs
        const emaValues = calculateEMA(config.shortTermEMAPeriod, closingPrices);

        if (emaValues.length === 0) {
            console.log(RED_TEXT, '\t✖ Failed to calculate EMA.');
            return;
        }

        const latestEMA = emaValues[emaValues.length - 1];
        console.log(GREEN_TEXT, "\t✔ Successfully calculated the latest EMA");

        // Calculate RSI
        const rsiValues = calculateRSI(config.RSIPeriod, closingPrices);

        if (rsiValues.length === 0) {
            console.log(RED_TEXT, '\t✖ Failed to calculate RSI.');
            return;
        }

        const latestRSI = rsiValues[rsiValues.length - 1];
        const previousRSI = rsiValues[rsiValues.length - 2]
        console.log(GREEN_TEXT, "\t✔ Successfully calculated the latest RSI");

        //Calculating Volatility-Based Position Sizina
        const baseCoinBalance = await getAvailableBalance(baseCoin)
        const buyQuantity = await convertBaseCoinToQuoteCoin(config.tradingPair, (await getTradingRules(config.tradingPair.replace('/', ''))).baseCoinMinBuyQty)
        const sellQuantity = await calculatePositionSize(baseCoinBalance, config.tradingPair.replace('/', ''), config.riskPerTrade, config.scalingFactor, config.ATRPeriod);

        //Debug logs:
        console.log(`
            - Latest EMA: ${latestEMA} 
            - Latest RSI: ${latestRSI} 
            - Previous RSI: ${previousRSI} 
            - Latest Closing Price: ${latestClosingPrice} 
            - Minimum Buying Quantity (in ${quoteCoin}): ${buyQuantity} 
            - Safest Selling Quantity (in ${baseCoin}): ${sellQuantity}
            `)

        // Search for Trade Signals
        console.log('\n > Searching for trade signals... \n');
        const tradeSignalResponse = await searchForTradeSignals(latestEMA, latestRSI, previousRSI, latestClosingPrice, config.overboughtThreshold, config.tradingPair, buyQuantity, sellQuantity, config.tpPercentage, config.slPercentage);

        console.log(`\n ${tradeSignalResponse.message}`);
        console.log('___________________________________\n');
    }

    // Run the trading logic once immediately after the trading bot initializes
    executeTrade();

    // Set up the interval to run the trading logic every 60 seconds
    setInterval(executeTrade, 60000);
}

// Trading Logic
async function searchForTradeSignals(latestEMA: number, latestRSI: number, previousRSI: number, latestClosingPrice: number, overboughtThreshold: number, tradingPair: string, buyQuantity: number, sellQuantity: number, tpPercentage: number, slPercentage: number): Promise<DefaultResponse> {
    try {
        const { buySignal, sellSignal } = getTradeSignal(latestClosingPrice, latestEMA, latestRSI, previousRSI, overboughtThreshold);

        if (buySignal) {
            console.log(GREEN_TEXT, "\t!! Buy Signal Detected!");
            const buyOrderResponse = await executeTrade(TradeAction.BUY, tradingPair, buyQuantity);
            return { isSuccessful: true, message: "Trade sequence finished. 1 trade was made.", data: buyOrderResponse };
        } else if (sellSignal) {
            console.log(RED_TEXT, "\t!! Sell Signal Detected!");
            const sellOrderResponse = await executeTrade(TradeAction.SELL, tradingPair, sellQuantity);
            return { isSuccessful: true, message: "Trade sequence finished. 1 trade was made.", data: sellOrderResponse };
        } else {
            console.log(RED_TEXT, "\t✖ No Trade Signal Detected ¯\_(ツ)_/¯");
            return { isSuccessful: true, message: "Trade sequence finished. No trade was made.", data: null };
        }
    } catch (error: any) {
        return { isSuccessful: false, message: "\tFailed to make trade: " + error.message, data: error };
    }
}

// Helper Functions
function getTradeSignal(latestClosingPrice: number, latestEMA: number, latestRSI: number, previousRSI: number, overboughtThreshold: number) {
    const isRSIRising = latestRSI > previousRSI; // Check if RSI is rising
    const isRSIFalling = latestRSI < previousRSI; // Check if RSI is falling

    const buySignal = latestClosingPrice > latestEMA && latestRSI < overboughtThreshold && isRSIRising;
    const sellSignal = latestClosingPrice < latestEMA && ((latestRSI > overboughtThreshold) || (latestRSI < config.oversoldThreshold)) && isRSIFalling;

    return { buySignal, sellSignal };
}

async function executeTrade(action: TradeAction, tradingPair: string, quantity: number): Promise<DefaultResponse> {
    try {
        const response = action === TradeAction.BUY
            ? await placeBuyOrder(tradingPair.replace('/', ''), quantity)
            : await placeSellOrder(tradingPair.replace('/', ''), quantity);

        console.log(response.isSuccessful ? GREEN_TEXT : RED_TEXT, response.message);
        return response;
    } catch (error: any) {
        console.log(RED_TEXT, `\t✖ Failed to execute ${action} order: ${error.message}`);
        return { isSuccessful: false, message: error.message, data: error };
    }
}

// Start the Bot
runBot().catch(console.error);