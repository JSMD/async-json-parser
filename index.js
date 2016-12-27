'use strict';

const stream = require('stream');

const errorState = Symbol('errorState');
const expectToken = Symbol('expectToken');
const expectString = Symbol('expectString');
const expectNumber = Symbol('expectNumber');
const expectFalse = Symbol('expectFalse');
const expectNull = Symbol('expectNull');
const expectTrue = Symbol('expectTrue');
const expectKey = Symbol('expectKey');
const endState = Symbol('endState');

const empty = Symbol('empty');

const toString = (value) => {

	return Object.prototype.toString.call(value);
};

const isArray = (value) => {

	return (toString(value) === '[object Array]');
};

const isObject = (value) => {

	return (toString(value) === '[object Object]');
};

const isWhitespace = (value) => {

	const isTab = (value === 0x09);
	const isLineFeed = (value === 0x0A);
	const isCarriageReturn = (value === 0x0D);
	const isSpace = (value === 0x20);

	return (isTab || isLineFeed || isCarriageReturn || isSpace);
};

class AsyncJSONParser extends stream.Transform {

	constructor() {

		super();

		// Set stream writable and writable states
		this._writableState.objectMode = false;
		this._readableState.objectMode = true;

		// Prepare parser members
		this.chunk = null;
		this.container = null;
		this.index = 0;
		this.key = empty;
		this.result = null;
		this.stack = [];
		this.state = expectToken;
		this.value = empty;

		// Prepare number members
		this.number = {
			digits: false,
			exponent: '',
			first: false,
			fraction: '',
			integer: '',
			point: false,
			power: false,
			sign: false
		};

		// Prepare string members
		this.string = {
			escape: false,
			hex: '',
			unicode: false
		};
	}

	// Stream.Transform _transform method implementation
	_transform(chunk, encoding, callback) {

		// Reset parsing chunk and index
		this.chunk = chunk;
		this.index = 0;

		// Behave based on the last state of the parser
		if (this.state === expectToken) {
			this.getNextToken();
		} else if (this.state === expectString || this.state === expectKey) {
			this.parseString();
		} else if (this.state === expectFalse) {
			this.parseValue('false');
		} else if (this.state === expectNull) {
			this.parseValue('null');
		} else if (this.state === expectTrue) {
			this.parseValue('true');
		}

		// End method
		callback();
	}

	// Stream.Transform _flush method implementation
	_flush(callback) {

		// Validate parser state
		if (this.state === expectNumber) {

			// Extract the number value
			this.extractNumber();

			// End parsing if there are no errors at extracting the number value
			if (this.state !== errorState) {
				this.endParsing();
			}
		} else if (this.state === endState) {
			this.endParsing();
		} else if (this.state !== errorState) {
			this.stopParsing();
		}

		// End method
		callback();
	}

	// End parsing and emit result
	endParsing() {

		// Skip ending whitespace
		this.skipWhitespace();

		// Check for container to select it as the value
		if (this.container) {
			this.value = this.container;
		}

		// Validate parser state
		if (this.chunk[this.index] || this.stack.length) {
			this.stopParsing();
		} else {
			this.result = this.value;
			this.emit('result', this.result);
		}
	}

	// Check for the next character and behave in a suitable way
	getNextToken() {

		// Skip any whitespace before getting next token
		this.skipWhitespace();

		let current = this.chunk[this.index];

		// (") check for string value or object key
		if (current === 0x22) {
			if (this.value === empty) {

				// Check for key or string parsing
				if (isObject(this.container) && this.key === empty) {
					this.state = expectKey;
				} else {
					this.state = expectString;
				}

				// Increase the index and prepare the string value
				this.index++;
				this.value = '';
				this.parseString();
			} else {
				this.stopParsing();
			}

		// (,) check for comma delimiter
		} else if (current === 0x2C) {
			if (this.container && this.value !== empty) {
				if (isArray(this.container)) {
					this.container.push(this.value);
					this.value = empty;
					this.index++;
					this.getNextToken();
				} else if (this.key === empty) {
					this.stopParsing();
				} else {
					this.container[this.key] = this.value;
					this.key = empty;
					this.value = empty;
					this.index++;
					this.getNextToken();
				}
			} else {
				this.stopParsing();
			}

		// (-|0-9) check for number value
		} else if (current === 0x2D || (current > 0x2F && current < 0x3A)) {
			if (this.value === empty) {
				this.state = expectNumber;
				this.value = '';
				this.parseNumber();
			} else {
				this.stopParsing();
			}

		// (:) check for delimiter between object keys and values
		} else if (current === 0x3A) {
			if (isObject(this.container) && this.value !== empty) {
				this.key = this.value;
				this.value = empty;
				this.index++;
				this.getNextToken();
			} else {
				this.stopParsing();
			}

		// ([) check for array begin
		} else if (current === 0x5B) {
			if (this.value === empty) {
				this.pushToStack();
				this.container = [];
				this.index++;
				this.getNextToken();
			} else {
				this.stopParsing();
			}

		// (]) check for array end
		} else if (current === 0x5D) {
			if (isArray(this.container)) {

				// Check for available value to add it to the array container
				if (this.value !== empty) {
					this.container.push(this.value);
				}

				// Get a new container from the stack
				this.popFromStack();
				this.index++;

				// Check for available container to continue or end parsing
				if (this.container) {
					this.getNextToken();
				} else {
					this.state = endState;
					this.endParsing();
				}
			} else {
				this.stopParsing();
			}

		// (f) check for "false" value
		} else if (current === 0x66) {
			if (this.value === empty) {
				this.state = expectFalse;
				this.value = '';
				this.parseValue('false');
			} else {
				this.stopParsing();
			}

		// (n) check for "null" value
		} else if (current === 0x6E) {
			if (this.value === empty) {
				this.state = expectNull;
				this.value = '';
				this.parseValue('null');
			} else {
				this.stopParsing();
			}

		// (t) check for "true" value
		} else if (current === 0x74) {
			if (this.value === empty) {
				this.state = expectTrue;
				this.value = '';
				this.parseValue('true');
			} else {
				this.stopParsing();
			}

		// ({) check for object begin
		} else if (current === 0x7B) {
			if (this.value === empty) {
				this.pushToStack();
				this.container = {};
				this.index++;
				this.getNextToken();
			} else {
				this.stopParsing();
			}

		// (}) check object end
		} else if (current === 0x7D) {
			if (isObject(this.container)) {

				// Check for available value to add it to the object container
				if (this.key !== empty && this.value !== empty) {
					this.container[this.key] = this.value;
					this.key = empty;
					this.value = empty;
				}

				// Get a new container from the stack
				this.popFromStack();
				this.index++;

				// Check for available container to continue or end parsing
				if (this.container) {
					this.getNextToken();
				} else {
					this.state = endState;
					this.endParsing();
				}
			} else {
				this.stopParsing();
			}
		} else {
			this.stopParsing();
		}
	}

	// Parse number values
	parseNumber() {

		const number = this.number;

		let current = this.chunk[this.index];

		// (-) check for the sign of the number
		if (!number.sign && !number.first && current === 0x2D) {
			number.integer = '-';
			number.sign = true;
			this.index++;
			current = this.chunk[this.index];
		}

		// Check for the first digit in a number
		if (!number.first) {

			// (0) check for a number that starts with zero
			if (current === 0x30) {
				number.integer += '0';
			}

			// Check for a number that starts with any non-zero digit
			else if (current > 0x30 && current < 0x3A) {
				number.integer += String.fromCharCode(current);
				number.digits = true;
			} else {
				this.stopParsing();
				return;
			}

			// Mark the first digit as parsed
			number.first = true;
			this.index++;
			current = this.chunk[this.index];
		}

		// Parse the next parts of the number
		while (current) {

			// Check for new digits to add them to the number parts
			if (number.digits && current > 0x2F && current < 0x3A) {
				if (!number.fraction && !number.exponent) {
					number.integer += String.fromCharCode(current);
				} else if (!number.exponent) {
					number.fraction += String.fromCharCode(current);
				} else {
					number.exponent += String.fromCharCode(current);
				}

			// (.) check for fraction separator
			} else if (!number.point && current === 0x2E) {
				number.fraction = '.';
				number.digits = true;
				number.point = true;
				number

			// (e|E) check for exponent separator
			} else if (!number.power && (current === 0x45 || current === 0x65)) {
				number.exponent = 'e';
				number.digits = true;
				number.point = false;
				number.power = false;
				number.sign = true;

			// (+|-) check for exponent sign
			} else if (number.sign && (current === 0x2B || current === 0x2D)) {
				number.exponent += String.fromCharCode(current);
				number.sign = false;
			} else {

				// Extract the number value
				this.extractNumber();

				// Check for container to continue or end parsing
				if (this.container) {
					this.getNextToken();
				} else {
					this.state = endState;
					this.endParsing();
				}

				return;
			}

			// Get the next character
			this.index++;
			current = this.chunk[this.index];
		}
	}

	// Parse object keys and string values
	parseString() {

		let current = this.chunk[this.index];

		// Get the characters of the string
		while (current) {

			// Check for escaped character
			if (this.string.escape) {

				// Check for unicode escape
				if (this.string.unicode) {

					// Prepare the unicode hex code
					this.string.hex += current.toString(16);

					// Check for full unicode hex code
					if (this.string.hex.length === 4) {

						const hex = Number.parseInt(this.string.hex, 16);

						// Check for valid hex number
						if (hex) {
							this.value += String.fromCharCode(hex);
							this.string.escape = false;
							this.string.unicode = false;
							this.string.hex = '';
						} else {
							this.stopParsing();
							break;
						}
					}

				// (") check for escaped double quote
				} else if (current === 0x22) {
					this.value += '"';
					this.string.escape = false;

				// (/) check for escaped slash
				} else if (current === 0x2F) {
					this.value += '/';
					this.string.escape = false;

				// (\) check for escaped backslash
				} else if (current === 0x5C) {
					this.value += '\\';
					this.string.escape = false;

				// (b) check for escaped backspace
				} else if (current === 0x62) {
					this.value += '\b';
					this.string.escape = false;

				// (f) check for escaped form feed
				} else if (current === 0x66) {
					this.value += '\f';
					this.string.escape = false;

				// (n) check for escaped line feed
				} else if (current === 0x6E) {
					this.value += '\n';
					this.string.escape = false;

				// (r) check for escaped carriage return
				} else if (current === 0x72) {
					this.value += '\r';
					this.string.escape = false;

				// (t) check for escaped horizontal tab
				} else if (current === 0x74) {
					this.value += '\t';
					this.string.escape = false;

				// (u) check for escaped unicode sequence
				} else if (current === 0x75) {
					this.string.unicode = true;
				}

			// (") check for the end of the string
			} else if (current === 0x22) {

				// Expect the next token
				this.state = expectToken;
				this.index++;

				// Check for container to continue or end parsing
				if (this.container) {
					this.getNextToken();
				} else {
					this.state = endState;
					this.endParsing();
				}

				break;

			// Check for non-printable characters
			} else if (current < 0x20 || current === 0x7F) {
				this.stopParsing();
				break;

			// (\) check for escape
			} else if (current === 0x5C) {
				this.string.escape = true;
			} else {
				this.value += String.fromCharCode(current);
			}

			// Get the next character
			this.index++;
			current = this.chunk[this.index];
		}
	}

	// Parse false, null and true values
	parseValue(value) {

		let current = this.chunk[this.index];
		let stop = this.index + value.length;
		let temp = '';

		// Check for previous temporary value
		if (this.value) {
			temp = this.value;
			stop -= temp.length;
		}

		// Append the value characters
		while (current && this.index < stop) {
			temp += String.fromCharCode(current);
			this.index++;
			current = this.chunk[this.index];
		}

		// Check the value
		if (temp === 'false') {
			this.value = false;
		} else if (temp === 'null') {
			this.value = null;
		} else if (temp === 'true') {
			this.value = true;
		}

		// Check for full value to continue parsing
		if (temp === value) {
			if (this.container) {
				this.state = expectToken;
				this.getNextToken();
			} else {
				this.state = endState;
			}
		} else if (temp.length < value.length) {
			this.value = temp;
		} else {
			this.stopParsing();
		}
	}

	// Remove the last container and key from the stack
	popFromStack() {

		const pop = this.stack.pop();

		// Save the container value
		this.value = this.container;

		// Check for available container and key in the stack
		if (pop) {
			this.container = pop.container;
			this.key = pop.key;
		} else {
			this.container = null;
		}
	}

	// Add the current container and key to the stack
	pushToStack() {
		if (this.container) {
			this.stack.push({
				container: this.container,
				key: this.key
			});
		}
	}

	// Skip redundant whitespace
	skipWhitespace() {

		let current = this.chunk[this.index];

		// Check for whitespace character and go to the next one
		while (current && isWhitespace(current)) {
			this.index++;
			current = this.chunk[this.index];
		}
	}

	// Set parser in error state, reset parsing and emit an error
	stopParsing() {

		// Set error parsing state
		this.state = errorState;

		// Reset parsing parts
		this.chunk = null;
		this.container = null;
		this.key = null;
		this.number = null;
		this.result = null;
		this.stack = null;
		this.string = null;
		this.value = null;

		// Emit the error that something bad happened :D
		this.emit('error', Error('Something bad happened'));
	}

	// Validate number value and set it in the currently parsed value
	extractNumber() {

		const number = this.number;
		const integer = number.integer;
		const fraction = number.fraction;
		const exponent = number.exponent;

		// Validate number parts
		if (fraction === '.' || /^e(?:\+|-)?$/.test(exponent)) {
			this.stopParsing();
		} else {

			// Form the number value
			this.value = Number(integer + fraction + exponent);

			// Reset number parts
			number.digits = false;
			number.exponent = '';
			number.first = false;
			number.fraction = '';
			number.integer = '';
			number.point = false;
			number.power = false;
			number.sign = false;
		}
	}

	// Synchronous method for parsing, equivalent to JSON.parse()
	static parse(input) {

		const parser = new AsyncJSONParser();

		// Check for the type of the input to stringify it or not
		if (Buffer.isBuffer(input) || typeof input === 'string') {
			parser.end(input);
		} else {
			parser.end(String(input));
		}

		return parser.result;
	}
}

module.exports = AsyncJSONParser;