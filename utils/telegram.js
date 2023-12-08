require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { csvJSON } = require("./csv");

const CHAT_ID = "-811651601";
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/chart (.+)/, async (msg, match) => {
	try {
		const resp = match[1];
		await sendPhoto(`./charts/${resp}.png`);
	} catch (e) {
		console.error(e.message);
		await sendMessage(e.message);
	}
});

bot.onText(/\/stats/, async () => {
	try {
		const timeseriesData = csvJSON("./logs/timeseries.csv");
		const latest = timeseriesData[timeseriesData.length - 1];
		await sendJsonAsMessage(latest);
	} catch (e) {
		console.error(e.message);
		await sendMessage(e.message);
	}
});

bot.onText(/\/position (.+)/, async (msg, match) => {
	try {
		const resp = match[1];
		const { getPositionData } = require("../binance/api");
		const positionData = await getPositionData(resp);
		await sendJsonAsMessage(positionData);
	} catch (e) {
		console.error(e.message);
		await sendMessage(e.message);
	}
});

bot.onText(/\/balance/, async (msg, match) => {
	try {
		const { getAccountInfo } = require("../binance/api");
		const futuresBalance = await getAccountInfo();
		await sendJsonAsMessage(futuresBalance);
	} catch (e) {
		console.error(e.message);
		await sendMessage(e.message);
	}
});

async function sendMessage(text) {
	try {
		await bot.sendMessage(CHAT_ID, text);
	} catch (e) {
		console.error(e.message);
	}
}

async function sendJsonAsMessage(jsonObject) {
	try {
		let text = "";
		for (const [key, val] of Object.entries(jsonObject)) {
			text += `${key}: ${val}\n`;
		}
		await sendMessage(text);
	} catch (e) {
		console.error(e.message);
	}
}

async function sendPhoto(path) {
	try {
		const fileOptions = {
			contentType: "image/png",
		};
		await bot.sendPhoto(CHAT_ID, path, {}, fileOptions);
	} catch (e) {
		console.error(e.message);
	}
}

module.exports = {
	sendMessage,
	sendJsonAsMessage,
	sendPhoto,
};
