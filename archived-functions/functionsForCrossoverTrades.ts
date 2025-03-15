// // Start Trading
//     async function executeTrade() {
//         console.log('___________________________________\n');
//         console.log('Commencing trade sequence... \n');

//         // Calculate EMAs
//         console.log('\n > Calculating EMAs... \n');
//         const [shortTermEMAdata, longTermEMAdata] = await Promise.all([
//             calculateEMA(tradingPair, 9, '1m'),
//             calculateEMA(tradingPair, 20, '1m')
//         ]);

//         console.log(shortTermEMAdata.isSuccessful ? "\x1b[32m%s\x1b[0m" : "\x1b[31m%s\x1b[0m", shortTermEMAdata.isSuccessful ? "\t✔ Successfully calculated short-term EMA data" : "\t✖ Failed to calculate short-term EMA: \n\t" + shortTermEMAdata.message);
//         console.log(longTermEMAdata.isSuccessful ? "\x1b[32m%s\x1b[0m" : "\x1b[31m%s\x1b[0m", longTermEMAdata.isSuccessful ? "\t✔ Successfully calculated long-term EMA data" : "\t✖ Failed to calculate long-term EMA: \n\t" + longTermEMAdata.message);

//         const shortTermEMA = shortTermEMAdata.data;
//         const longTermEMA = longTermEMAdata.data;
//         if (shortTermEMA && longTermEMA) {
//             const tradeResponse = await trade(shortTermEMA, longTermEMA, tradingPair, quantity, tpPercentage, slPercentage);
            
//             console.log(`\n ${tradeResponse.message}`)
//             console.log('___________________________________\n');
//         }

        
//     }

//     // Run the trading logic once immediately after the trading bot initializes
//     executeTrade();

//     // Set up the interval to run the trading logic every 60 seconds
//     setInterval(executeTrade, 60000);
// }
// // Trading Logic
// async function trade(shortTermEMA: number[], longTermEMA: number[], tradingPair: string, quantity: number, tpPercentage: number, slPercentage: number): Promise<DefaultResponse> {
//     try {
//         const crossoverResponse = await searchForCrossover(shortTermEMA, longTermEMA)

//         //buy long order on golden cross
//         if(crossoverResponse.isGoldenCross){
//             console.log("\x1b[32m%s\x1b[0m", "\t!! Golden Cross Detected!")
//             const longOrderResponse = await placeLongOrder(tradingPair.replace('/', ''), quantity, tpPercentage, slPercentage)
//             console.log((longOrderResponse.isSuccessful ? "\x1b[32m%s\x1b[0m" : "\x1b[31m%s\x1b[0m"), longOrderResponse.message)
        
//         //buy short order on death cross
//         } else if(crossoverResponse.isDeathCross){
//             console.log("\x1b[32m%s\x1b[0m", "\t!! Death Cross Detected!")
//             const shortOrderResponse = await stopLongOrder(tradingPair.replace('/', ''), quantity, tpPercentage, slPercentage)
//             console.log((shortOrderResponse.isSuccessful ? "\x1b[32m%s\x1b[0m" : "\x1b[31m%s\x1b[0m"), shortOrderResponse.message)
//         } else {
//             console.log("\x1b[31m%s\x1b[0m", "\t✖ No Crossover Detected ¯\_(ツ)_/¯")
//         }
        
//         return {isSuccessful: true, message: (crossoverResponse.isGoldenCross || crossoverResponse.isDeathCross ? "Trade sequence finished. 1 trade was made." : "Trade sequence finished. No trade was been made."), data: "who cares"}
//     } catch (error: any) {
//         return {isSuccessful: false, message: "\tFailed to make trade God knows why: " + error.message, data: error}
//     }
    
// }
