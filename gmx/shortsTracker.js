const { bnToNum } = require("../utils/utils");
const { contracts } = require("./network");

async function getGlobalShortAveragePrice(token) {
	const contract = contracts.shortsTracker.getContract();
	const globalShortAveragePrice = bnToNum(await contract.globalShortAveragePrices(token), 30);
	return globalShortAveragePrice;
}

module.exports = {
	getGlobalShortAveragePrice,
};
