import { RestClientV5 } from 'bybit-api';
import * as dotenv from 'dotenv';
import { convertBaseCoinToQuoteCoin, fetchCurrentPrice } from './priceData';
import { DefaultResponse } from './interfaces/responses';

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

enum OrderAction {
  BUY = "Buy",
  SELL = "Sell"
}

enum OrderCategory {
  SPOT = "spot",
  LINEAR = "linear",
  OPTION = "option",
  INVERSE = "inverse"
}

export async function getTradingRules(tradingPair: string) {
  let statusMessage = ""
  let baseCoinMinBuyQty = 0
  try {
      const response = await client.getInstrumentsInfo({
          category: 'spot', // Use 'linear' for futures
          symbol: tradingPair,
      });

      if (response.retCode !== 0) {
          statusMessage = `✖ Failed to fetch trading rules: ${response.retMsg}`
          return {baseCoinMinBuyQty, statusMessage}
      }

      if(!response.result?.list[0]){
        statusMessage = `✖ Failed to fetch list of trading rules: ${response.result.list[0]}`
        return {baseCoinMinBuyQty, statusMessage}
      }

      const symbolInfo = response.result.list[0];
      baseCoinMinBuyQty = parseFloat(symbolInfo.lotSizeFilter.minOrderQty); // Minimum order quantity for base coin quantity
      // const quoteCoinMinBuyQty = await convertBaseCoinToQuoteCoin(tradingPair, baseCoinMinBuyQty)

      // //Debug logs:
      // console.log(`Lowest amount of ${symbolInfo.baseCoin} you can buy using ${symbolInfo.quoteCoin}: ${baseCoinMinBuyQty} ${symbolInfo.baseCoin}`);
      // console.log(`Lowest amount of ${symbolInfo.quoteCoin} you need to buy ${symbolInfo.baseCoin}: ${quoteCoinMinBuyQty} ${symbolInfo.quoteCoin}`);
      
      statusMessage = '\t✔ Successfully retrieved minimum buy quantity'
      return { baseCoinMinBuyQty, statusMessage };
  } catch (error: any) {
      statusMessage = 'Error fetching trading rules: ' + error.message
      return {baseCoinMinBuyQty, statusMessage}
  }
}

// Generic function to place an order
async function placeOrder(tradingPair: string, quantity: number, side: OrderAction, category: OrderCategory, tpPrice?: string, slPrice?: string) {
    console.log(`\n > Placing ${side} Order for ${tradingPair}... \n`);
    try {
        const response = await client.submitOrder({
            category: category,
            symbol: tradingPair,
            side: side,
            orderType: 'Market',
            qty: quantity.toString(),
        });

        if (response.retCode === 0) {
            console.log(`\t✔ ${side} Order Placed:`, response.result);

        // //Place TP/SL Orders (if provided)
        // if (tpPrice) {
        //     await placeLimitOrder(tradingPair, quantity, OrderAction.SELL, tpPrice);
        // }

        // if (slPrice) {
        //     await placeStopLossOrder(tradingPair, quantity, OrderAction.SELL, slPrice);
        // }

            return { isSuccessful: true, message: `\t✔ Successfully placed ${side} order.`, data: response.result };
        } else {
            return { isSuccessful: false, message: `\t✖ Failed to place ${side} order: ${response.retMsg}`, data: null };
        }
    } catch (error: any) {
        return { isSuccessful: false, message: `✖ Server error while placing ${side} order: ${error.message}`, data: error };
    }
}

export async function placeBuyOrder(tradingPair: string, quantity: number) {
  return placeOrder(tradingPair, quantity, OrderAction.BUY, OrderCategory.SPOT);
}

export async function placeSellOrder(tradingPair: string, quantity: number) {
    return placeOrder(tradingPair, quantity, OrderAction.SELL, OrderCategory.SPOT);
}

export async function placeLongOrder(tradingPair: string, quantity: number, tpPercentage: number, slPercentage: number) {
    try {
        const { data: currentPrice } = await fetchCurrentPrice(tradingPair);
        const tpPrice = (Number(currentPrice) * (1 + tpPercentage)).toFixed(2);
        const slPrice = (Number(currentPrice) * (1 - slPercentage)).toFixed(2);

        return placeOrder(tradingPair, quantity, OrderAction.BUY, OrderCategory.LINEAR, tpPrice, slPrice);
    } catch (error: any) {
        return { isSuccessful: false, message: `✖ Error fetching current price: ${error.message}`, data: error };
    }
}

export async function placeShortOrder(tradingPair: string, quantity: number, tpPercentage: number, slPercentage: number) {
    try {
        const { data: currentPrice } = await fetchCurrentPrice(tradingPair);
        const tpPrice = (Number(currentPrice) * (1 - tpPercentage)).toFixed(2);
        const slPrice = (Number(currentPrice) * (1 + slPercentage)).toFixed(2);

        return placeOrder(tradingPair, quantity, OrderAction.SELL, OrderCategory.LINEAR, tpPrice, slPrice);
    } catch (error: any) {
        return { isSuccessful: false, message: `✖ Error fetching current price: ${error.message}`, data: error };
    }
}

// Function to place a Limit Order for Take-Profit
async function placeLimitOrder(tradingPair: string, quantity: number, side: OrderAction, price: string) {
  console.log(`\n > Placing Take-Profit Limit Order at ${price}...`);
  try {
      const response = await client.submitOrder({
          category: 'spot',
          symbol: tradingPair,
          side: side,
          orderType: 'Limit',
          qty: quantity.toFixed(2),
          price: price.toString()
      });

      return response.retCode === 0 ? 
          console.log(`\t✔ Take-Profit Order Placed at $${price}`) :
          console.log(`\t✖ Failed to place TP order: ${response.retMsg}`);
  } catch (error: any) {
      console.log(`\t✖ Server error while placing TP order: ${error.message}`);
  }
}

// Function to place a Stop-Loss Order
async function placeStopLossOrder(tradingPair: string, quantity: number, side: OrderAction, stopPrice: string) {
  console.log(`\n > Placing Stop-Loss Order at ${stopPrice}...`);
  try {
      const response = await client.submitOrder({
          category: 'spot',
          symbol: tradingPair,
          side: side,
          orderType: 'Limit',
          qty: quantity.toFixed(2),
          slOrderType: "Limit",
          price: stopPrice.toString() // Execution price (same as stop price)
      });

      console.log(response.retMsg);
      return response.retCode === 0 ? 
          console.log(`\t✔ Stop-Loss Order Placed at $${stopPrice}`) :
          console.log(`\t✖ Failed to place SL order: ${response.retMsg}`);
  } catch (error: any) {
      console.log(`\t✖ Server error while placing SL order: ${error.message}`);
  }
}

