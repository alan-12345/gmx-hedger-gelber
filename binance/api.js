const { MARGIN_TYPE, TARGET_LEVERAGE } = require("../constants/constants");
const { startWriter } = require("../utils/csv");
const { logLines } = require("../utils/logger");
const { numToUsd } = require("../utils/utils");
const { countDecimals } = require("../utils/math");
const { sendMessage, sendJsonAsMessage } = require("../utils/telegram");
const { getRequestInstance } = require("./request");
const _ = require("lodash");

const writer = startWriter("./logs/errors.csv", ["time", "function", "parameters", "message"]);

function convertSymbol(symbol) {
	if (!symbol) return;

	symbol = symbol.toUpperCase();
	if (symbol == "WBTC") symbol = "BTC";
	else if (symbol == "WETH") symbol = "ETH";

	return symbol + "USDT";
}

async function getExchangeInfo() {
	try {
		const { request } = getRequestInstance({});
		const res = (await request.get(`/fapi/v1/exchangeInfo`)).data;
		return res;
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "getExchangeInfo",
			parameters: [],
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function sanitizeQuantity(exchangeInfo, symbol, quantity) {
	if (!exchangeInfo || !symbol || !quantity) return;

	try {
		const symbolInfo = exchangeInfo.symbols;
		symbol = convertSymbol(symbol);
		const symbolData = symbolInfo.find((data) => data.symbol == symbol && data.contractType == "PERPETUAL").filters;

		const lotSize = symbolData.find((filter) => filter.filterType == "LOT_SIZE");
		const { minQty, maxQty, stepSize: stepSizeStr } = lotSize;
		if (quantity < minQty) {
			console.log(`${symbol}: quantity < min (${quantity} < ${minQty})`);
			return 0;
		} else if (quantity > maxQty) {
			console.log(`${symbol}: quantity > max (${quantity} > ${maxQty})`);
			return 0;
		}
		const stepSize = parseFloat(stepSizeStr);
		const decimals = countDecimals(stepSize);
		quantity = parseFloat((Math.round(quantity / stepSize) * stepSize).toFixed(decimals));
		return quantity;
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "sanitizeQuantity",
			parameters: [symbol, quantity].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function getPositionData(symbol) {
	if (!symbol) return;

	try {
		symbol = convertSymbol(symbol);
		const query = {
			symbol,
		};
		const { request, path } = getRequestInstance(query);
		const res = (await request.get(`/fapi/v2/positionRisk${path}`)).data[0];
		if (res.marginType.toUpperCase() != MARGIN_TYPE) {
			await setMarginType(symbol);
		}
		if (parseFloat(res.leverage) != TARGET_LEVERAGE) {
			await setInitialLeverage(symbol);
		}

		const positionData = {
			symbol: res.symbol,
			positionAmt: parseFloat(res.positionAmt),
			entryPrice: parseFloat(res.entryPrice),
			markPrice: parseFloat(res.markPrice),
			unrealizedProfit: parseFloat(res.unRealizedProfit),
			liquidationPrice: parseFloat(res.liquidationPrice),
			leverage: parseFloat(-res.notional) / parseFloat(res.isolatedMargin),
			isolatedMargin: parseFloat(res.isolatedMargin),
			notional: parseFloat(res.notional),
			isolatedWallet: parseFloat(res.isolatedWallet),
			updateTime: parseFloat(res.updateTime),
		};
		return positionData;
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "getPositionData",
			parameters: [symbol].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function getIncomeHistory(symbol, startTime, endTime) {
	try {
		const query = {
			symbol,
			startTime,
			endTime,
			limit: 1000,
		};

		const { request, path } = getRequestInstance(query);
		const res = (await request.get(`/fapi/v1/income${path}`)).data;
		return res;
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "getIncomeHistory",
			parameters: [symbol, startTime, endTime].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function getRealizedProfit(symbol, start, end) {
	if (!symbol) return;

	try {
		symbol = convertSymbol(symbol);
		let merged = [];
		const interval = 1000 * 60 * 60 * 24; // 24 hours
		for (let startTime = start; startTime < end; startTime += interval) {
			const endTime = startTime + interval > end ? end : startTime + interval;
			const incomeHistory = await getIncomeHistory(symbol, startTime, endTime);
			if (!incomeHistory) return;
			merged = _.union(merged, incomeHistory);
		}
		if (merged.length == 0) return 0;

		const realizedPnl = merged.reduce((a, b) => a + parseFloat(b.income), 0);
		return realizedPnl;
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "getRealizedProfit",
			parameters: [symbol].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function getAccountInfo() {
	try {
		const query = {};

		const { request, path } = getRequestInstance(query);
		const res = (await request.get(`/fapi/v2/account${path}`)).data;
		const accountInfo = {
			balance: parseFloat(res.totalWalletBalance),
			available: parseFloat(res.availableBalance),
			uPnl: parseFloat(res.totalUnrealizedProfit),
		};

		return accountInfo;
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "getAccountInfo",
			parameters: [],
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function setMarginType(symbol) {
	try {
		const query = {
			symbol,
			marginType: MARGIN_TYPE,
		};

		const { request, path } = getRequestInstance(query);
		logLines();
		await request.post(`/fapi/v1/marginType${path}`);
		const text = `Set ${symbol} margin type to ${MARGIN_TYPE}`;
		console.log(text);
		logLines();
		await sendMessage(text);
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "setMarginType",
			parameters: [symbol].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function setInitialLeverage(symbol) {
	try {
		const query = {
			symbol,
			leverage: TARGET_LEVERAGE,
		};

		const { request, path } = getRequestInstance(query);

		logLines();
		await request.post(`/fapi/v1/leverage${path}`);
		const text = `Set ${symbol} initial leverage to ${TARGET_LEVERAGE}`;
		console.log(text);
		logLines();
		await sendMessage(text);
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "setInitialLeverage",
			parameters: [symbol].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function modifyPositionMargin(symbol, amount, type) {
	try {
		const query = {
			symbol,
			amount,
			type,
		};

		const { request, path } = getRequestInstance(query);

		logLines();
		await request.post(`/fapi/v1/positionMargin${path}`);
		const text = `Modified ${symbol} margin by ${type == 1 ? "+" : "-"}${amount}`;
		console.log(text);
		logLines();
		await sendMessage(text);
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "modifyPositionMargin",
			parameters: [symbol, amount, type].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function addMargin(symbol, quantity) {
	if (!symbol || !quantity) return;

	try {
		symbol = convertSymbol(symbol);
		quantity = parseFloat(quantity.toFixed(2));
		await modifyPositionMargin(symbol, quantity, 1);
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "addMargin",
			parameters: [symbol, quantity].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function reduceMargin(symbol, quantity) {
	if (!symbol || !quantity) return;

	try {
		symbol = convertSymbol(symbol);
		quantity = parseFloat(quantity.toFixed(2));
		await modifyPositionMargin(symbol, quantity, 2);
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "reduceMargin",
			parameters: [symbol, quantity].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function createOrder(symbol, side, type, quantity) {
	try {
		const query = {
			symbol,
			side,
			type,
			quantity,
			newOrderRespType: "RESULT",
		};
		const { request, path } = getRequestInstance(query);
		logLines();
		const res = await request.post(`/fapi/v1/order${path}`);
		const { avgPrice } = res.data;
		const text = `${symbol} ${type} ${side} ${quantity} @ ${numToUsd(parseFloat(avgPrice))}`;
		console.log(text);
		logLines();
		await sendMessage(text);
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "createOrder",
			parameters: [symbol, side, type, quantity].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function createBuyOrder(symbol, quantity) {
	if (!symbol || !quantity) return;

	try {
		symbol = convertSymbol(symbol);
		await createOrder(symbol, "BUY", "MARKET", quantity);
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "createBuyOrder",
			parameters: [symbol, quantity].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

async function createSellOrder(symbol, quantity) {
	if (!symbol || !quantity) return;

	try {
		symbol = convertSymbol(symbol);
		await createOrder(symbol, "SELL", "MARKET", quantity);
	} catch (e) {
		console.error(e.message);
		const error = {
			time: Date.now(),
			function: "createSellOrder",
			parameters: [symbol, quantity].join(" | "),
			message: e.message,
		};
		writer.write(error);
		await sendJsonAsMessage(error);
	}
}

module.exports = {
	getExchangeInfo,
	getPositionData,
	getAccountInfo,
	getRealizedProfit,
	addMargin,
	reduceMargin,
	createBuyOrder,
	createSellOrder,
	sanitizeQuantity,
};
