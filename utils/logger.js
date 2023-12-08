function logLines() {
	console.log("=".repeat(50));
}

function logTitle(title) {
	logLines();
	console.log(title);
	logLines();
}

function throwError(text) {
	throw new Error(text);
}

module.exports = {
	logLines,
	logTitle,
	throwError,
};
