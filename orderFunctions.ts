import { RestClientV5 } from 'bybit-api';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { fetchCurrentPrice } from './priceData';
import { DefaultResponse } from './interfaces/responses';

dotenv.config(); // Load environment variables from .env file

// Safely retrieve environment variables
const apiKey = process.env.BYBIT_API_KEY || "";
const apiSecret = process.env.BYBIT_API_SECRET || "";

if (!apiKey || !apiSecret) {
  throw new Error('BYBIT_API_KEY and BYBIT_API_SECRET must be set in the environment variables.');
}

// Initialize the Bybit client
const client = new RestClientV5({
  key: apiKey,
  secret: apiSecret,
  testnet: false, // Use testnet for testing
});

// Fetch account balance
export async function placeLongOrder(tradingPair: string, quantity: number, tpPercentage: number, slPercentage: number): Promise<DefaultResponse> {

    console.log('\n > Placing Long Order... \n')
    try {
      const currentPriceData = await fetchCurrentPrice(tradingPair)
      const currentPrice = currentPriceData.data
      const tpPrice = (Number(currentPrice) * (1 + tpPercentage)).toString()
      const slPrice = (Number(currentPrice) * (1 - slPercentage)).toString()

      const response = await client.submitOrder({
        category: 'linear', // Linear perpetual contracts
        symbol: tradingPair, // Trading pair
        side: 'Buy', // Buy to go long
        orderType: 'Market', // Market order
        qty: quantity.toString(), // Quantity to buy
        takeProfit: tpPrice,
        stopLoss: slPrice
      });

      if (response.retCode === 0) {
        console.log('\tLong Order Placed: \n\t', response.result);

        console.log('\n\tGetting Target Prices...')
        const order = await client.getActiveOrders({
            category: 'linear',
            symbol: tradingPair,
            openOnly: 1,
            limit: 1
        })
    
        const entryPrice: string = order['result']['list'][0]['avgPrice']
        const tp_price: string = order.result.list[0].takeProfit
        const sl_price: string = order.result.list[0].stopLoss

        console.log('\t- Entry Price:', '$'+entryPrice)
        console.log(`\t- Take-Profit Price set at: $${tp_price}`,  ) 
        console.log(`\t- Stop-Loss Price set at: $${sl_price}` )

        return {isSuccessful: true, message: "\n\t✔ Successfully made long order.", data: order.result.list[0]}

      } else {
        return {isSuccessful: false, message: `\t✖ Failed to place long order due to api error: ${response.retMsg}`, data: null}
      }
    } catch (error: any) {
      return {isSuccessful: false,  message: `✖ Failed to place long order due to server error: ${error.message}`, data: error}
    }
  }

  export async function stopLongOrder(tradingPair: string, quantity: number, tpPercentage: number, slPercentage: number){
    
    console.log('\n > Placing Short Order... \n');
    try {
      const currentPriceData = await fetchCurrentPrice(tradingPair)
      const currentPrice = currentPriceData.data
      const slPrice = (Number(currentPrice) * (1 + slPercentage)).toString()
      const tpPrice = (Number(currentPrice) * (1 - tpPercentage)).toString()

      const response = await client.submitOrder({
        category: 'linear',
        symbol: tradingPair,
        side: 'Sell',
        orderType: 'Market',
        qty: quantity.toString(),
        takeProfit: tpPrice,
        stopLoss: slPrice
      })

      if (response.retCode == 0){
        console.log('\tShort Order Placed: ', response.result);

        console.log('\n\tGetting Target Prices...')
        const order = await client.getActiveOrders({
            category: 'linear',
            symbol: tradingPair,
            openOnly: 1,
            limit: 1
        })
    
        const entryPrice: string = order['result']['list'][0]['avgPrice']
        const tp_price: string = order.result.list[0].takeProfit
        const sl_price: string = order.result.list[0].stopLoss

        console.log('\t- Entry Price:', '$'+entryPrice)
        console.log(`\t- Take-Profit Price set at: $${tp_price}`,  ) 
        console.log(`\t- Stop-Loss Price set at: $${sl_price}` )

        return {isSuccessful: true, message: "\n\t✔ Successfully made short order.", data: order.result.list[0]}
      } else {
        return {isSuccessful: false, message: `\t✖ Failed to place short order due to api error: ${response.retMsg}`, data: null}
      }
    } catch (error: any) {
      return {isSuccessful: false,  message: `\t✖ Failed to place short order due to server error: ${error.message}`, data: error}
    }
  }