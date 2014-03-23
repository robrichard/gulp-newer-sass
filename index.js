var Transform = require('stream').Transform;
var fs = require('fs');
var path = require('path');
var util = require('util');
var sassGraph = require('sass-graph');

var Q = require('kew');
var gutil = require('gulp-util');

var PluginError = gutil.PluginError;

function Newer(dest, options) {
    Transform.call(this, {objectMode: true});

    if (!dest) {
        throw new PluginError('Requires a dest string');
    }

    /**
     * Path to destination directory or file.
     * @type {string}
     */
    this._dest = dest;

    /**
     * Optional extension for destination files.
     * @type {string}
     */
    this._ext = '.css';
    if (options && options.verbose) {
        this._verbose = true;
    }
    this._log = function () {
        if (this._verbose) {
            var plugin = '[' + gutil.colors.cyan('gulp-newer-sass') + ']';
            var args = Array.prototype.slice.call(arguments);
            args.unshift(plugin);
            gutil.log.apply(gutil, args)
        }
    }

}
util.inherits(Newer, Transform);


/**
 * Pass through newer files only.
 * @param {File} srcFile A vinyl file.
 * @param {string} encoding Encoding (ignored).
 * @param {function(Error, File)} done Callback.
 */
Newer.prototype._transform = function(srcFile, encoding, done) {
    var graph = sassGraph.parseFile(srcFile.path);

    if (!srcFile || !srcFile.stat) {
        done(new PluginError('gulp-newer-sass', 'Expected a source file with stats'));
        return;
    }
    var self = this;
    // stat dest/relative file
    var destFileRelative = srcFile.relative.replace(/\..*?$/, self._ext);
    Q.nfcall(fs.stat, path.join(self._dest, destFileRelative)).fail(function(err) {
        if (err.code === 'ENOENT') {
            // dest file doesn't exist, pass through all
            return Q.resolve(null);
        } else {
            // unexpected error
            return Q.reject(err);
        }
    }).then(function(destFileStats) {
            var newer = false;
            if (destFileStats) {
                graph.visitDescendents(srcFile.path, function(f) {
                    var stat = fs.statSync(f);
                    if (stat.mtime > destFileStats.mtime) {
                        self._log('Newer file detected', f);
                        newer = true;
                    }
                });
                if (newer) {
                    self._log('Pushing', srcFile.path);
                    self.push(srcFile);
                } else {
                    self._log('skipping', srcFile.path);
                }
            } else {
                self._log('Destination file does not exist. Pushing', srcFile.path);
                self.push(srcFile);
            }
            done();
        }, done);

};

/**
 * Only pass through source files that are newer than the provided destination.
 * @param {string} dest Path to destination directory or file.
 * @return {Newer} A transform stream.
 */
module.exports = function(dest, options) {
    return new Newer(dest, options);
};