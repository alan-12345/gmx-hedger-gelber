const { contracts } = require("./network");
const { getDecimals, getSymbol } = require("./erc20");
const { bnToNum } = require("../utils/utils");
const { throwError } = require("../utils/logger");
const { getGlobalShortAveragePrice } = require("./shortsTracker");

async function getTokenData() {
	const tokenAddresses = await getWhitelistedTokens();
	const tokens = {};
	for (const token of tokenAddresses) {
		const [decimals, symbol, isStable, isShortable] = await Promise.all([
			getDecimals(token),
			getSymbol(token),
			getIsStableToken(token),
			getIsShortableToken(token),
		]);
		tokens[token] = {
			decimals,
			symbol,
			isStable,
			isShortable,
		};
	}
	return tokens;
}

async function getWhitelistedTokens() {
	const contract = contracts.vault.getContract();
	const numTokens = await contract.allWhitelistedTokensLength();
	const tokensPromises = [];
	for (let i = 0; i < numTokens; i++) {
		tokensPromises.push(contract.allWhitelistedTokens(i));
	}
	const tokens = await Promise.all(tokensPromises);
	return tokens;
}

async function getIsStableToken(token) {
	const contract = contracts.vault.getContract();
	const isStable = await contract.stableTokens(token);
	return isStable;
}

async function getIsShortableToken(token) {
	const contract = contracts.vault.getContract();
	const isShortable = await contract.shortableTokens(token);
	return isShortable;
}

async function getMinPrice(token) {
	const contract = contracts.vault.getContract();
	const minPrice = bnToNum(await contract.getMinPrice(token), 30);
	if (!minPrice) throwError(`${token} price is ${minPrice}`);
	return minPrice;
}

async function getMaxPrice(token) {
	const contract = contracts.vault.getContract();
	const maxPrice = bnToNum(await contract.getMaxPrice(token), 30);
	if (!maxPrice) throwError(`${token} price is ${maxPrice}`);
	return maxPrice;
}

async function getPrice(token) {
	const [minPrice, maxPrice] = await Promise.all([getMinPrice(token), getMaxPrice(token)]);
	const price = (minPrice + maxPrice) / 2;
	if (!price) throwError(`${token} price is ${price}`);
	return price;
}

async function getGlobalShortUsd(token) {
	const contract = contracts.vault.getContract();
	const globalShortSize = bnToNum(await contract.globalShortSizes(token), 30);
	return globalShortSize;
}

async function getGlobalShortSize(token) {
	const [globalShortPrice, globalShortUsd] = await Promise.all([
		getGlobalShortAveragePrice(token),
		getGlobalShortUsd(token),
	]);
	const shortSize = globalShortUsd / globalShortPrice;
	return shortSize;
}

async function getGlobalLongSize(token, decimals) {
	const contract = contracts.vault.getContract();
	const longSize = bnToNum(await contract.reservedAmounts(token), decimals);
	return longSize;
}

async function getPoolAmount(token, decimals) {
	const contract = contracts.vault.getContract();
	const poolAmount = bnToNum(await contract.poolAmounts(token), decimals);
	return poolAmount;
}

module.exports = {
	getTokenData,
	getMinPrice,
	getMaxPrice,
	getPrice,
	getGlobalShortSize,
	getGlobalLongSize,
	getPoolAmount,
};
