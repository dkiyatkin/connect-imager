var imager = require('../index.js')({
	cache_dir: __dirname + '/cache',
	root: __dirname
});

exports.imager = {
	'imager': function(test) {
		test.done();
	}
};
