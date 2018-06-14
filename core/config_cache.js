/* jslint node: true */
'use strict';

//	deps
const paths				= require('path');
const fs				= require('graceful-fs');
const hjson				= require('hjson');
const sane				= require('sane');

module.exports = new class ConfigCache
{
	constructor() {
		this.cache		= new Map();	//	path->parsed config
	}

	getConfigWithOptions(options, cb) {
		const cached = this.cache.has(options.filePath);

		if(options.forceReCache || !cached) {
			this.recacheConfigFromFile(options.filePath, (err, config) => {
				if(!err && !cached) {
					const watcher = sane(
						paths.dirname(options.filePath),
						{
							glob : `**/${paths.basename(options.filePath)}`
						}
					);

					watcher.on('change', (fileName, fileRoot) => {
						require('./logger.js').log.info( { fileName, fileRoot }, 'Configuration file changed; re-caching');

						this.recacheConfigFromFile(paths.join(fileRoot, fileName), err => {
							if(!err) {
								if(options.callback) {
									options.callback( { fileName, fileRoot } );
								}
							}
						});
					});
				}
				return cb(err, config, true);
			});
		} else {
			return cb(null, this.cache.get(options.filePath), false);
		}
	}

	getConfig(filePath, cb) {
		return this.getConfigWithOptions( { filePath }, cb);
	}

	recacheConfigFromFile(path, cb) {
		fs.readFile(path, { encoding : 'utf-8' }, (err, data) => {
			if(err) {
				return cb(err);
			}

			let parsed;
			try {
				parsed = hjson.parse(data);
				this.cache.set(path, parsed);
			} catch(e) {
				require('./logger.js').log.error( { filePath : path, error : e.message }, 'Failed to re-cache' );
				return cb(e);
			}

			return cb(null, parsed);
		});
	}
};
