const { bnToNum } = require("../utils/utils");
const { contracts } = require("./network");

async function getGlpPrice() {
	const contract = contracts.glpManager.getContract();
	const [priceMax, priceMin] = await Promise.all([
		contract.getPrice(true),
		contract.getPrice(false),
	]);
	const rawGlpPrice = priceMax.add(priceMin).div(2);
	const glpPrice = bnToNum(rawGlpPrice, 30);
	return glpPrice;
}

async function getGlobalShortAveragePrice(token) {
	const contract = contracts.glpManager.getContract();
	const globalShortAveragePrice = bnToNum(await contract.getGlobalShortAveragePrice(token), 30);
	return globalShortAveragePrice;
}

module.exports = {
	getGlpPrice,
	getGlobalShortAveragePrice,
};
