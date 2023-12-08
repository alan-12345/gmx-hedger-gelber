require("dotenv").config();
const crypto = require("crypto");
const { default: axios } = require("axios");
const { BINANCE_F_ENDPOINT } = require("../constants/constants");

function generateSignature(query, timestamp) {
	return crypto
		.createHmac("sha256", process.env.BINANCE_API_SECRET)
		.update(buildQueryString({ ...query, timestamp }).substring(1))
		.digest("hex");
}

function buildQueryString(q) {
	return q
		? `?${Object.keys(q)
				.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(q[k])}`)
				.join("&")}`
		: "";
}

function getRequestInstance(query) {
	const timestamp = Date.now();
	const signature = generateSignature(query, timestamp);
	query.timestamp = timestamp;
	query.signature = signature;
	const config = {
		headers: {
			"X-MBX-APIKEY": process.env.BINANCE_API_KEY,
			"Accept-Encoding": "deflate",
		},
		baseURL: BINANCE_F_ENDPOINT,
	};
	return {
		request: axios.create(config),
		path: buildQueryString(query),
	};
}

module.exports = {
	getRequestInstance,
};
