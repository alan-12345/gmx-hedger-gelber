const { ethers } = require("ethers");

function bnToNum(bn, decimals = 18) {
	return parseFloat(ethers.utils.formatUnits(bn, decimals));
}

function numToBn(num, decimals = 18) {
	return ethers.utils.parseUnits(num.toFixed(decimals), decimals);
}

function numToUsd(num, decimals = 2) {
	return (num >= 0 ? "$" : "-$") + Math.abs(num.toFixed(decimals));
}

function numToPercent(num, decimals = 2) {
	return (num * 100).toFixed(decimals) + "%";
}

async function sleep(seconds) {
	await new Promise((res) => setTimeout(res, 1000 * seconds));
}

module.exports = {
	bnToNum,
	numToBn,
	numToUsd,
	numToPercent,
	sleep,
};
