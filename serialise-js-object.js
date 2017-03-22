'use strict';

const jsonStableStringify = require('json-stable-stringify');

module.exports = {
	test,
	print,
};

function test (maybeObject) {
	// OK for both objects and arrays
	return (typeof maybeObject === 'object');
}

function print (object) {
	// Use stable stringify to ensure that the keys are always sorted in the same order,
	// which is vital since string comparisons are used
	return jsonStableStringify(object, {
		space: '  ',
	});
}
