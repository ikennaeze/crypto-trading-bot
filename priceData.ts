import { DefaultResponse } from "./interfaces/responses"

const ccxt = require('ccxt')

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
