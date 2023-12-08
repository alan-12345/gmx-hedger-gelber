const { bnToNum } = require("../utils/utils");
const { contracts, addresses } = require("./network");
const { getPrice } = require("./vault");

async function getClaimableData(account) {
	const feeGlpContract = contracts.rewardTracker.getContract(addresses.feeGlp);
	const feeStakedGlpContract = contracts.rewardTracker.getContract(addresses.feeStakedGlp);
	const [rawClaimableNative, price, rawClaimableGmx] = await Promise.all([
		feeGlpContract.claimable(account),
		getPrice(addresses.native),
		feeStakedGlpContract.claimable(account),
	]);
	const claimableNative = bnToNum(rawClaimableNative);
	const claimableGmx = bnToNum(rawClaimableGmx);
	const claimableData = {
		nativeReward: claimableNative,
		nativeRewardUsd: claimableNative * price,
		gmxReward: claimableGmx,
	};
	return claimableData;
}

module.exports = {
	getClaimableData,
};
