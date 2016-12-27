'use strict';

const tap = require('tap');

const AsyncJSONParser = require('./index');

const testValue = (test, value) => {

	const expected = JSON.stringify(value);
	const result = JSON.stringify(AsyncJSONParser.parse(expected));

	test.ok(expected === result, `${expected} === ${result}`);
};

const testString = (test, string) => {

	const expected = JSON.stringify(JSON.parse(string));
	const result = JSON.stringify(AsyncJSONParser.parse(string));

	test.ok(expected === result, `${expected} === ${result}`);
};

tap.test('No input', (test) => {
	try {
		AsyncJSONParser.parse();
		test.throw();
	} catch (error) {
		test.end();
	}
});

tap.test('Empty input', (test) => {
	try {
		AsyncJSONParser.parse('');
		test.throw();
	} catch (error) {
		test.end();
	}
});

tap.test('Space input', (test) => {
	try {
		AsyncJSONParser.parse(' ');
		test.throw();
	} catch (error) {
		test.end();
	}
});

tap.test('Empty string input', (test) => {
	testValue(test, '');
	test.end();
});

tap.test('One char string input', (test) => {
	testValue(test, 's');
	test.end();
});

tap.test('Escaped char string input', (test) => {
	testValue(test, '\n');
	test.end();
});

tap.test('Non-printable char string input', (test) => {
	try {
		AsyncJSONParser.parse('"\n"');
		test.throw();
	} catch (error) {
		test.end();
	}
});

tap.test('Empty array input', (test) => {
	testValue(test, []);
	test.end();
});

tap.test('Array inside array', (test) => {
	testValue(test, [[]]);
	test.end();
});

tap.test('false', (test) => {
	testValue(test, false);
	test.end();
});

tap.test('null', (test) => {
	testValue(test, null);
	test.end();
});

tap.test('true', (test) => {
	testValue(test, true);
	test.end();
});

tap.test('Empty object input', (test) => {
	testValue(test, {});
	test.end();
});

tap.test('null, false, true', (test) => {
	testValue(test, null);
	testValue(test, false);
	testValue(test, true);
	test.end();
});

tap.test('strings', (test) => {
	testValue(test, '');
	testValue(test, 's');
	testValue(test, 'string');
	test.end();
});