const fs = require("fs");
const csvWriter = require("csv-write-stream");

function startWriter(path, headers) {
	let writer;
	if (!fs.existsSync(path)) {
		writer = csvWriter({
			headers,
		});
	} else {
		writer = csvWriter({ sendHeaders: false });
	}

	writer.pipe(fs.createWriteStream(path, { flags: "a" }));
	return writer;
}

function csvJSON(path) {
	const csv = fs.readFileSync(path).toString();
	var lines = csv.split("\n");

	var result = [];

	var headers = lines[0].split(",");

	for (var i = 1; i < lines.length - 1; i++) {
		var obj = {};
		var currentline = lines[i].split(",");

		for (var j = 0; j < headers.length; j++) {
			obj[headers[j]] = currentline[j];
		}

		result.push(obj);
	}

	return result;
}

module.exports = {
	startWriter,
	csvJSON,
};
