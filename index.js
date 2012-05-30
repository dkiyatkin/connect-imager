var _imager = function(orig_img_path, cache_img_path, req, next) {
	if (!req.query.w) { req.query.w = ''; }
	if (!req.query.h) { req.query.h = ''; }
	//console.log(orig_img_path, cache_img_path);
	var geometry = req.query.w+'x'+req.query.h;
	if (!req.query.c) {
		im.convert([orig_img_path, '-scale', geometry+'>', cache_img_path], function(err, metadata) {
			if (err) { console.log(err); }
			next();
		});
	} else {
		im.convert([orig_img_path, '-scale', geometry+'^', '-crop', geometry+'+0+0', cache_img_path], function(err, metadata) {
			if (err) { console.log(err); }
			next();
		});
	}
};
var __imager = function(cache_img_path, orig_img_path, orig_img_stats, req, next) {
	//console.log(req.url);
	path.exists(cache_img_path, function(exists) {
		if (!exists) {
			_imager(orig_img_path, cache_img_path, req, next);
		} else {
			fs.stat(cache_img_path, function(err, cache_img_stats) {
				if (orig_img_stats.mtime.getTime() > cache_img_stats.mtime.getTime()) {
					_imager(orig_img_path, cache_img_path, req, next);
				} else {
					next();
				}
			});
		}
	});
};
var imager = function(cache_dir) {
	return function(req, res, next) {
		if (req.url_parse.query &&
		(req.query.w || req.query.h) && (mime.lookup(req.url_parse.pathname).split('/')[0]=='image')) {
			var pathname = decodeURI(path.join('/',req.url_parse.pathname));
			// если такое изображение есть, взять с параметрами
			var orig_img_path = path.join(__dirname, pathname);
			path.exists(orig_img_path, function(exists) {
				if (exists) {
					fs.stat(orig_img_path, function(err, orig_img_stats) {
						req.url = path.join(cache_dir, pathname.slice(1).replace(/\//g, '•')); //part cache url
						var image_dir = path.join(__dirname, req.url);
						path.exists(image_dir, function(exists) {
							var image = '';
							if (req.query.w) { image += 'w'+req.query.w; }
							if (req.query.h) { image += 'h'+req.query.h; }
							if (req.query.c) { image += 'c'+req.query.c; }
							// путь до кэшированного изображения
							req.url = path.join(req.url, image + path.extname(pathname));
							var cache_img_path = path.join(__dirname, req.url);
							req.url = encodeURI(req.url);
							if (!exists) {
								mkdirp(image_dir, function(err) {
									if (err) {
										console.log(err);
										next();
									} else { __imager(cache_img_path, orig_img_path, orig_img_stats, req, next); }
								});
							} else { __imager(cache_img_path, orig_img_path, orig_img_stats, req, next); }
						});
					});
				} else { next(); }
			});
		} else { next(); }
	};
};
