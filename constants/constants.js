const LOGS_ENABLED = true;
const RPC_URL = "https://arb1.arbitrum.io/rpc";
const INTERVAL = 5; // in seconds
const MIN_LEVERAGE = 5;
const TARGET_LEVERAGE = 6;
const MAX_LEVERAGE = 7;
const HEDGE_BUFFER = 0.005;
const BINANCE_F_ENDPOINT = "https://fapi.binance.com";
const MARGIN_TYPE = "ISOLATED";

module.exports = {
	LOGS_ENABLED,
	RPC_URL,
	INTERVAL,
	MIN_LEVERAGE,
	TARGET_LEVERAGE,
	MAX_LEVERAGE,
	HEDGE_BUFFER,
	BINANCE_F_ENDPOINT,
	MARGIN_TYPE,
};
