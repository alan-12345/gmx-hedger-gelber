const fs = require("fs");
const moment = require("moment");
require("chartjs-adapter-moment");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const { csvJSON } = require("../utils/csv");
const { getPrice } = require("../gmx/vault");
const { addresses } = require("../gmx/network");

const chartJSNodeCanvas = new ChartJSNodeCanvas({
	width: 1280,
	height: 720,
	backgroundColour: "white",
});

function unixToLocal(time) {
	return moment(time).utcOffset(-360).toObject();
}

async function generateNetWorthChart() {
	try {
		const timeseriesData = csvJSON("./logs/timeseries.csv");

		const startingNetWorth = +timeseriesData[0].netWorth;
		const networthData = timeseriesData.map((data) => {
			return {
				x: unixToLocal(+data.time),
				y: +data.netWorth - startingNetWorth,
			};
		});

		const price = await getPrice(addresses.native);
		const startingNetWorthWithRewards =
			+timeseriesData[0].netWorth + +timeseriesData[0].nativeReward * price;
		const totalNetWorthData = timeseriesData.map((data) => {
			return {
				x: unixToLocal(+data.time),
				y: +data.netWorth + +data.nativeReward * price - startingNetWorthWithRewards,
			};
		});

		const options = {
			elements: {
				point: {
					radius: 0,
				},
			},
			scales: {
				x: {
					type: "time",
				},
				y1: {
					display: true,
					position: "left",
				},
			},
		};

		const config = {
			type: "line",
			data: {
				datasets: [
					{
						label: "NW Delta w/o Rewards",
						yAxisID: "y1",
						data: networthData,
						fill: true,
						borderColor: "green",
					},
					{
						label: "NW Delta w/ Rewards",
						yAxisID: "y1",
						data: totalNetWorthData,
						fill: true,
						borderColor: "blue",
					},
				],
			},
			options,
		};
		const buffer = await chartJSNodeCanvas.renderToBuffer(config);
		fs.writeFileSync("./charts/networth.png", buffer, "base64");
	} catch (e) {
		console.log(e.message);
	}
}

async function generateLongsVsShortsChart() {
	try {
		const timeseriesData = csvJSON("./logs/timeseries.csv");

		const startingLongPnl = +timeseriesData[0].glpPrice * +timeseriesData[0].glpBalance;
		const longsData = timeseriesData.map((data) => {
			return {
				x: unixToLocal(+data.time),
				y: +data.glpPrice * +data.glpBalance - startingLongPnl,
			};
		});
		const startingShortPnl =
			+timeseriesData[0].unrealizedProfit + +timeseriesData[0].realizedProfit;
		const shortsData = timeseriesData.map((data) => {
			return {
				x: unixToLocal(+data.time),
				y: -(+data.unrealizedProfit + +data.realizedProfit - startingShortPnl),
			};
		});

		const options = {
			elements: {
				point: {
					radius: 0,
				},
			},
			scales: {
				x: {
					type: "time",
				},
				y1: {
					display: true,
					position: "left",
				},
			},
		};

		const config = {
			type: "line",
			data: {
				datasets: [
					{
						label: "Longs",
						yAxisID: "y1",
						data: longsData,
						fill: true,
						borderColor: "green",
					},
					{
						label: "Shorts",
						yAxisID: "y1",
						data: shortsData,
						fill: true,
						borderColor: "#eb3639",
					},
				],
			},
			options,
		};
		const buffer = await chartJSNodeCanvas.renderToBuffer(config);
		fs.writeFileSync("./charts/vs.png", buffer, "base64");
	} catch (e) {
		console.log(e.message);
	}
}

async function generateAllChart() {
	try {
		const timeseriesData = csvJSON("./logs/timeseries.csv");

		const startingLongPnl = +timeseriesData[0].glpPrice * +timeseriesData[0].glpBalance;
		const longPnlData = timeseriesData.map((data) => {
			return {
				x: unixToLocal(+data.time),
				y: (+data.glpPrice * +data.glpBalance - startingLongPnl) / +data.glpBalance,
			};
		});
		const startingShortPnl =
			+timeseriesData[0].unrealizedProfit + +timeseriesData[0].realizedProfit;
		const shortPnlData = timeseriesData.map((data) => {
			return {
				x: unixToLocal(+data.time),
				y: (+data.unrealizedProfit + +data.realizedProfit - startingShortPnl) / +data.glpBalance,
			};
		});

		const netData = timeseriesData.map((data, i) => {
			return {
				x: unixToLocal(+data.time),
				y: longPnlData[i].y + shortPnlData[i].y,
			};
		});
		const options = {
			elements: {
				point: {
					radius: 0,
				},
			},
			scales: {
				x: {
					type: "time",
				},
				y1: {
					display: true,
					position: "left",
					ticks: {
						callback: (val) => {
							return (val * 100).toFixed(2) + "%";
						},
					},
				},
			},
		};

		const config = {
			type: "line",
			data: {
				datasets: [
					{
						label: "Longs Delta",
						yAxisID: "y1",
						data: longPnlData,
						fill: false,
						borderColor: "green",
					},
					{
						label: "Shorts Delta",
						yAxisID: "y1",
						data: shortPnlData,
						fill: false,
						borderColor: "#eb3639",
					},
					{
						label: "Net Delta",
						yAxisID: "y1",
						data: netData,
						fill: false,
						borderColor: "black",
					},
				],
			},
			options,
		};
		const buffer = await chartJSNodeCanvas.renderToBuffer(config);
		fs.writeFileSync("./charts/all.png", buffer, "base64");
	} catch (e) {
		console.log(e.message);
	}
}

async function generateCharts() {
	await Promise.all([generateAllChart(), generateLongsVsShortsChart(), generateNetWorthChart()]);
}

module.exports = {
	generateCharts,
};
