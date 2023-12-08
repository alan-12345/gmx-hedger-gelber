const { bnToNum } = require("../utils/utils");
const { contracts } = require("./network");

async function getDecimals(token) {
	const contract = contracts.erc20.getContract(token);
	const decimals = await contract.decimals();
	return decimals;
}

async function getSymbol(token) {
	const contract = contracts.erc20.getContract(token);
	const symbol = await contract.symbol();
	return symbol;
}

async function getTotalSupply(token) {
	const contract = contracts.erc20.getContract(token);
	const [rawTotalSupply, decimals] = await Promise.all([
		contract.totalSupply(),
		getDecimals(token),
	]);
	const totalSupply = bnToNum(rawTotalSupply, decimals);
	return totalSupply;
}

async function getBalance(token, account) {
	const contract = contracts.erc20.getContract(token);
	const [rawBalance, decimals] = await Promise.all([
		contract.balanceOf(account),
		getDecimals(token),
	]);
	const balance = bnToNum(rawBalance, decimals);
	return balance;
}

module.exports = { getDecimals, getSymbol, getTotalSupply, getBalance };
