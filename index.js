var fs = require('fs');
var path = require('path');
var url = require('url');
var connect = require('connect');
var querystring = require('querystring');
var mime = require('mime');
var im = require('imagemagick');
var mkdirp = require('mkdirp');

module.exports = function(options) {
	var _imager = function(req, res, orig_img_path, cache_img_path, query, next) {
		if (!query.w) { query.w = ''; }
		if (!query.h) { query.h = ''; }
		var geometry = query.w+'x'+query.h;
		if (!query.c) {
			im.convert([orig_img_path, '-scale', geometry+'>', cache_img_path], function(err, metadata) {
				if (err) { console.log(err); }
				connectStatic(req, res, function() { res.writeHead(404); res.end('Not Found'); });
			});
		} else {
			im.convert([orig_img_path, '-scale', geometry+'^', '-crop', geometry+'+0+0', cache_img_path], function(err, metadata) {
				if (err) { console.log(err); }
				connectStatic(req, res, function() { res.writeHead(404); res.end('Not Found'); });
			});
		}
	};
	var __imager = function(req, res, cache_img_path, orig_img_path, orig_img_stats, query, next) {
		fs.exists(cache_img_path, function(exists) {
			if (!exists) {
				_imager(req, res, orig_img_path, cache_img_path, query, next);
			} else {
				fs.stat(cache_img_path, function(err, cache_img_stats) {
					if (orig_img_stats.mtime.getTime() > cache_img_stats.mtime.getTime()) {
						_imager(req, res, orig_img_path, cache_img_path, query, next);
					} else {
						connectStatic(req, res, function() { res.writeHead(404); res.end('Not Found'); });
					}
				});
			}
		});
	};
	var cache_dir = '/'+path.relative(options.root, options.cache_dir); // url от root
	var connectStatic = connect.static(options.root, { maxAge: options.maxAge, hidden: options.hidden }); // oneDay
	return function(req, res, next) {
		var url_parse = url.parse(req.url);
		if ((mime.lookup(url_parse.pathname).split('/')[0] === 'image') && (url_parse.search)) { // это изображение
			url_parse = url.parse(url_parse.pathname + '?' + url_parse.search.replace(/.*\?/,'')); // оставить по последний вопрос
			var query = querystring.parse(url_parse.query);
			if (query.w || query.h) {
				var pathname = decodeURI(path.join('/',url_parse.pathname));
				var orig_img_path = path.join(options.public_dir, pathname);
				fs.exists(orig_img_path, function(exists) {
					if (exists) {
						fs.stat(orig_img_path, function(err, orig_img_stats) {
							if (!err) {
								var old_req_url = req.url;
								req.url = path.join(cache_dir, pathname.slice(1).replace(/\//g, '|')); //part cache url от root
								var image_dir = path.join(options.root, req.url);
								var image = '';
								if (query.w) { image += 'w'+query.w; }
								if (query.h) { image += 'h'+query.h; }
								if (query.c) { image += 'c'+query.c; }
								req.url = path.join(req.url, image + path.extname(pathname)); // путь до кэшированного изображения
								var cache_img_path = path.join(options.root, req.url);
								req.url = encodeURI(req.url);
								fs.exists(image_dir, function(exists) {
									if (!exists) {
										mkdirp(image_dir, function(err) {
											if (err) {
												req.url = old_req_url;
												console.error(2, err);
												next(); // возвращаем оригинал
											} else { __imager(req, res, cache_img_path, orig_img_path, orig_img_stats, query, next); }
										});
									} else { __imager(req, res, cache_img_path, orig_img_path, orig_img_stats, query, next); }
								});
							} else { console.error(1, err); next(); } // возвращаем оригинал
						});
					} else { next(); } // отправляем дальше на стандартный ответ 404
				});
			} else { next(); } // нет нужных параметров, возвращается оригинальное изображение, если оно есть
		} else { next(); } // иди с этим путем дальше
	};
};
