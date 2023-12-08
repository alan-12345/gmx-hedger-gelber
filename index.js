require("dotenv").config();
const moment = require("moment");
const {
	HEDGE_BUFFER,
	MIN_LEVERAGE,
	INTERVAL,
	LOGS_ENABLED,
	MAX_LEVERAGE,
	TARGET_LEVERAGE,
} = require("./constants/constants.js");
const { addresses } = require("./gmx/network.js");
const { getBalance, getTotalSupply } = require("./gmx/erc20.js");
const { getTokenData, getGlobalLongSize, getGlobalShortSize, getPoolAmount } = require("./gmx/vault");
const { getGlpPrice } = require("./gmx/glpManager.js");
const { generateCharts } = require("./charts/chart.js");
const { startWriter } = require("./utils/csv.js");
const { logTitle, logLines } = require("./utils/logger.js");
const { numToUsd, numToPercent, sleep } = require("./utils/utils.js");
const { getClaimableData } = require("./gmx/feeGlp.js");
const {
	getPositionData,
	reduceMargin,
	addMargin,
	createSellOrder,
	createBuyOrder,
	getExchangeInfo,
	sanitizeQuantity,
	getAccountInfo,
} = require("./binance/api.js");
const { sendMessage } = require("./utils/telegram.js");

async function run(tokensData, exchangeInfo) {
	const now = Date.now();
	logTitle(`Cycle started @ ${moment(now).utcOffset(-360).format("h:mm:ss a")}`);

	let hasError = false;

	const [totalSupply, glpBalance, glpPrice, claimableData] = await Promise.all([
		getTotalSupply(addresses.stakedGlp),
		getBalance(addresses.stakedGlp, addresses.account),
		getGlpPrice(),
		getClaimableData(addresses.account),
	]);
	const poolPercentage = glpBalance / totalSupply;

	for (const [indexToken, data] of Object.entries(tokensData)) {
		if (!data.isShortable) continue;

		const { decimals, symbol } = data;

		const res = await Promise.all([
			getGlobalLongSize(indexToken, decimals),
			getGlobalShortSize(indexToken),
			getPoolAmount(indexToken, decimals),
			getPositionData(symbol),
		]);

		const hasNullOrUndefined = res.some((element) => element === null || element === undefined);
		if (hasNullOrUndefined) {
			hasError = true;
			const error = `Failed to get position data for ${symbol}`;
			logTitle(error);
			await sendMessage(error);
			await sleep(10);
			continue;
		}

		const [globalLongSize, globalShortSize, poolAmount, positionData] = res;
		const { positionAmt, notional, liquidationPrice, leverage, isolatedMargin, markPrice } = positionData;

		const currentShortSize = -positionAmt;
		const netSize = globalLongSize - globalShortSize;
		const percentLong = globalLongSize / (globalLongSize + globalShortSize);
		const percentShort = globalShortSize / (globalLongSize + globalShortSize);
		const targetShortSize = poolPercentage * (poolAmount - netSize);

		logLines();
		console.log(
			`Pool: ${poolAmount.toFixed()} ${symbol} | ` +
				`Long: ${globalLongSize.toFixed()} (${numToPercent(percentLong)}) | ` +
				`Short: ${globalShortSize.toFixed()} (${numToPercent(percentShort)}) | ` +
				`Net: ${netSize.toFixed()} ${symbol}`
		);
		console.log(
			`Target short: ${targetShortSize.toFixed(4)} ${symbol} ` + `(${numToUsd(targetShortSize * markPrice)})`
		);
		console.log(`Current short: ${currentShortSize.toFixed(4)} ${symbol} ` + `(${numToUsd(-notional)})`);
		console.log(
			`Leverage: ${leverage.toFixed(2)} ` +
				`(Liq. price: ${numToUsd(liquidationPrice)} | Current: ${numToUsd(markPrice)})`
		);

		// Ensure positions aren't over/under leveraged
		if (leverage >= MAX_LEVERAGE || leverage <= MIN_LEVERAGE) {
			const marginDelta = parseFloat(-notional) / TARGET_LEVERAGE - isolatedMargin;
			if (marginDelta > 0) {
				await addMargin(symbol, marginDelta * 1.01);
			} else {
				await reduceMargin(symbol, -(marginDelta * 0.99));
			}
		}

		// Create short position if none exists
		if (currentShortSize == 0) {
			// If short position doesn't exist, short optimal amount
			const sanitizedQty = await sanitizeQuantity(exchangeInfo, symbol, targetShortSize);
			await createSellOrder(symbol, sanitizedQty);
		} else {
			// Ensure existing hedge is within bounds
			if (Math.abs(targetShortSize - currentShortSize) / targetShortSize > HEDGE_BUFFER) {
				if (currentShortSize < targetShortSize) {
					// If short position is not short enough, increase short
					const amountToIncrease = targetShortSize - currentShortSize;
					const sanitizedQty = await sanitizeQuantity(exchangeInfo, symbol, amountToIncrease);
					await createSellOrder(symbol, sanitizedQty);
				} else {
					// If short position is too short, reduce shorts
					const amountToDecrease = currentShortSize - targetShortSize;
					const sanitizedQty = await sanitizeQuantity(exchangeInfo, symbol, amountToDecrease);
					await createBuyOrder(symbol, sanitizedQty);
				}
			}
		}
	}
	const accountInfo = await getAccountInfo();
	if (!accountInfo) {
		await sleep(10);
	} else {
		const glpValue = glpBalance * glpPrice;
		const netWorth = glpValue + accountInfo.balance + accountInfo.uPnl;
		const { nativeReward, nativeRewardUsd, gmxReward } = claimableData;

		if (LOGS_ENABLED && !hasError) {
			const tsWriter = startWriter("./logs/timeseries.csv", [
				"time",
				"glpPrice",
				"glpBalance",
				"glpValue",
				"netWorth",
				"nativeReward",
				"nativeRewardUsd",
				"gmxReward",
			]);

			tsWriter.end({
				time: now,
				glpPrice,
				glpBalance,
				glpValue,
				netWorth,
				nativeReward,
				nativeRewardUsd,
				gmxReward,
			});

			tsWriter.on("close", async () => {
				await sleep(0.5);
				await generateCharts();
			});
		}

		logLines();
		console.log(`Balance: ${glpBalance.toFixed(2)} GLP ` + `(${numToUsd(glpValue, 2)})`);
		console.log(`Net worth: ${numToUsd(netWorth)}`);
		console.log(
			`Native rewards: ${nativeReward.toFixed(4)} ` +
				`${tokensData[addresses.native].symbol} (${numToUsd(nativeRewardUsd)})`
		);
		console.log(`esGMX rewards: ${gmxReward.toFixed(4)} esGMX`);
		logLines();
	}

	logTitle(`Cycle completed @ ${moment(now).utcOffset(-360).format("h:mm:ss a")} in ${Date.now() - now}ms`);

	setTimeout(() => {
		run(tokensData, exchangeInfo);
	}, INTERVAL * 1000);
}

async function start() {
	logTitle("Version: 2.0.9");
	logTitle("Starting bot");
	logTitle(`Account: ${addresses.account}`);

	logTitle(`Fetching token and exchange info`);
	const [tokens, exchangeInfo] = await Promise.all([getTokenData(), getExchangeInfo()]);

	await run(tokens, exchangeInfo);
}

start();
