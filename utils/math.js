function binarySearch(arr, target, l, r) {
	while (l < r) {
		const mid = Math.floor((l + r) / 2);
		if (arr[mid] < target) l = mid + 1;
		else if (arr[mid] > target) r = mid;
		else return mid;
	}
	if (l === r) return arr[l] >= target ? l : l + 1;
}

function filterOutliers(arr = [], num = 1) {
	let l = 0,
		r = num - 1,
		res = [];
	const window = arr.slice(l, num);
	window.sort((a, b) => a - b);
	while (r < arr.length) {
		const median =
			num % 2 === 0
				? (window[Math.floor(num / 2) - 1] + window[Math.floor(num / 2)]) / 2
				: window[Math.floor(num / 2)];
		res.push(median);
		let char = arr[l++];
		let index = binarySearch(window, char, 0, window.length - 1);
		window.splice(index, 1);
		char = arr[++r];
		index = binarySearch(window, char, 0, window.length - 1);
		window.splice(index, 0, char);
	}
	return res;
}

function countDecimals(a) {
	if (!isFinite(a)) return 0;
	var e = 1,
		p = 0;
	while (Math.round(a * e) / e !== a) {
		e *= 10;
		p++;
	}
	return p;
}

module.exports = {
	filterOutliers,
	countDecimals,
};
