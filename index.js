var Transform = require('stream').Transform;
var fs = require('fs');
var path = require('path');
var util = require('util');
var sassGraph = require('sass-graph');

var Q = require('kew');
var gutil = require('gulp-util');

var PluginError = gutil.PluginError;

function Newer(options) {
    Transform.call(this, {objectMode: true});

    if (!options) {
        throw new PluginError('Requires a dest string');
    }

    /**
     * Path to destination directory or file.
     * @type {string}
     */
    this._dest = options;

    /**
     * Optional extension for destination files.
     * @type {string}
     */
    this._ext = '.css';

    /**
     * Promise for the dest file/directory stats.
     * @type {[type]}
     */
    this._destStats = Q.nfcall(fs.stat, this._dest);

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
    console.log('testing if newer than', path.join(self._dest, destFileRelative));
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
        graph.visitDescendents(srcFile.path, function(f) {
            var stat = fs.statSync(f);
            if (stat.mtime > destFileStats.mtime) {
                console.log(f, 'is newer');
                newer = true;
            }
        });
        if (newer) {
            console.log('pushing', srcFile.path);
            self.push(srcFile);
        } else {
            console.log('skipping', srcFile.path);
        }
        done();
    }, done);

};

/**
 * Only pass through source files that are newer than the provided destination.
 * @param {string} dest Path to destination directory or file.
 * @return {Newer} A transform stream.
 */
module.exports = function(options) {
    return new Newer(options);
};