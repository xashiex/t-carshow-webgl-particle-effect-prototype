Math.random2 = function(v) {
	return (Math.random() * 2 - 1) * v;
}
Math.rad2Deg = function(rad) {
	var deg = (rad / Math.PI / 2 * 360) % 360;
	while (deg < 0) deg+=360;
	return deg;
}
Math.deg2Rad = function(deg) {
	return (deg % 360) / 360 * Math.PI * 2;
}