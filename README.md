# Async JSON Parser

An async JSON parser made just for fun for JSMD community

## Usage

```js
const AJP = require('async-json-parser');

// Sync method
AJP.parse('[null]');

// Async approach
const parser = new AJP();

// Wait for result
parser.on('result', (result) => {
    console.log(result);
});

// Write data to the parser stream
parser.write('[');
parser.write('nu');
parser.write('ll]');
parser.end();
```

## Testing

`npm test`

## Benchmarking

`npm run benchmark`

### What still can be done?
- Optimizations (this can be done always)
- Better error messages (now it only throws an error with the message `Something bad happened`)
- Comments parsing (non-standard, but can be useful)
- Reviver argument for the sync method (to match JSON.parse())
- More tests (there are just some simple tests)