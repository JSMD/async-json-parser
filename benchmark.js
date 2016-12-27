const benchmark = require('benchmark');

const AsyncJSONParser = require('./index');

const suite = new benchmark.Suite();

const input = '[]';

// add tests
suite.add('JSON.parse()', function() {
  JSON.parse(input);
})
.add('AsyncJSONParser.parse()', function() {
  AsyncJSONParser.parse(input);
})
// add listeners
.on('cycle', function(event) {
  console.log(String(event.target));
})
.on('complete', function() {
  console.log('Fastest is ' + this.filter('fastest').map('name'));
})
// run async
.run({ 'async': true });