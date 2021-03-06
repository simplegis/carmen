var fs = require('fs');
var path = require('path');
var Stream = require('stream');
var Carmen = require('..');
var index = require('../lib/index');
var indexdocs = require('../lib/indexer/indexdocs.js');
var mem = require('../lib/api-mem');
var token = require('../lib/util/token');

var UPDATE = process.env.UPDATE;
var test = require('tape');
var termops = require('../lib/util/termops');

test('index - streaming interface', function(assert) {
    var inputStream = fs.createReadStream(path.resolve(__dirname, './fixtures/small-docs.jsonl'), { encoding: 'utf8' });

    var outputStream = new Stream.Writable();
    outputStream._write = function(chunk, encoding, done) {
        var doc = JSON.parse(chunk.toString());

        //Only print on error or else the logs are super long
        if (!doc.id) assert.ok(doc.id, 'has id: ' + doc.id);
        done();
    };

    var conf = {
        to: new mem([], null, function() {})
    };

    var carmen = new Carmen(conf);
    assert.test('index docs.json', function(q) {
        carmen.index(inputStream, conf.to, {
            zoom: 6,
            output: outputStream
        }, function(err) {
            q.ifError(err);
            q.end();
        });
    });
    assert.test('ensure index was successful', function(q) {
        carmen.analyze(conf.to, function(err, stats) {
            q.ifError(err);
            // Updates the mem-analyze.json fixture on disk.
            if (UPDATE) fs.writeFileSync(__dirname + '/fixtures/mem-analyze-small.json', JSON.stringify(stats, null, 4));
            q.deepEqual(require('./fixtures/mem-analyze-small.json'), stats);
            q.end();
        });
    });
    assert.end();
});

test('index.generateStats', function(assert) {
    var docs = [{
        type: "Feature",
        properties: {
            "carmen:text": 'main street',
            "carmen:score": 2
        },
        geometry: {}
    },{
        type: "Feature",
        properties: {
            "carmen:text": 'Main Road',
            "carmen:score": 1
        },
        geometry: {}
    }];
    var geocoder_tokens = token.createReplacer({'street':'st','road':'rd'});
    assert.deepEqual(indexdocs.generateFrequency(docs, {}), {
        __COUNT__: [ 4 ],
        __MAX__: [ 2 ],
        main: [ 2 ],
        road: [ 1 ],
        street: [ 1 ]
    });
    // @TODO should 'main' in this case collapse down to 2?
    assert.deepEqual(indexdocs.generateFrequency(docs, geocoder_tokens), {
        __COUNT__: [ 4 ],
        __MAX__: [ 2 ],
        main: [ 2 ],
        rd: [ 1 ],
        st: [ 1 ]
    });
    assert.end();
});

test('index.update -- error', function(t) {
    var memdocs = require('./fixtures/mem-docs.json');
    var conf = { to: new mem(memdocs, null, function() {}) };
    var carmen = new Carmen(conf);
    t.ok(carmen);
    t.test('update 1', function(q) {
        index.update(conf.to, [{
            id: 1,
            type: "Feature",
            properties: {
                'carmen:text': 'main st',
                'carmen:score': 10,
                'carmen:center': [0,0]
            },
            geometry: {
                type:'Point',
                coordinates:[0,0]
            }
        }], { zoom: 6 }, function(err) {
            q.ifError(err);
            q.deepEqual(conf.to._geocoder.freq.get('__COUNT__'), [2]);
            q.deepEqual(conf.to._geocoder.freq.get('__MAX__'), [10]);
            q.end();
        });
    });
    t.test('update 2', function(q) {
        index.update(conf.to, [{
            id: 1,
            type: "Feature",
            properties: {
                'carmen:text': 'main st',
                'carmen:score': 0,
                'carmen:center': [0,0],
            },
            geometry: {
                type:'Point',
                coordinates:[0,0]
            }
        }], { zoom: 6 }, function(err) {
            q.ifError(err);
            q.deepEqual(conf.to._geocoder.freq.get('__COUNT__'), [4]);
            q.deepEqual(conf.to._geocoder.freq.get('__MAX__'), [10]);
            q.end();
        });
    });
    t.end();
});

test('index.update freq', function(t) {
    var conf = { to: new mem(null, function() {}) };
    var carmen = new Carmen(conf);
    t.ok(carmen);
    t.test('error no id', function(q) {
        index.update(conf.to, [{ properties: { 'carmen:text': 'main st' } }], { zoom: 6 }, function(err) {
            q.equal('Error: doc has no id', err.toString());
            q.end();
        });
    });
    t.test('error no carmen:center', function(q) {
        index.update(conf.to, [{ id: 1, type: 'Feature', properties: { 'carmen:text': 'main st' } }], { zoom: 6 }, function(err) {
            q.equal('Error: "geometry" property required on id:1', err.toString());
            q.end();
        });
    });
    t.test('indexes single doc', function(q) {
        index.update(conf.to, [{ id: 1, type: 'Feature', properties: { 'carmen:text': 'main st', 'carmen:center':[0,0]}, geometry: { type: 'Point', coordinates: [0,0] } }], { zoom: 6 }, function(err) {
            q.ifError(err);
            q.end();
        });
    });
    t.test('indexes doc with geometry and no carmen:center', function(q) {
        var doc = { id:1, type: 'Feature', properties: { 'carmen:text': 'main st' }, geometry:{ type:'Point', coordinates: [-75.598211,38.367333]}};
        index.update(conf.to, [doc], { zoom: 6 }, function(err, res, too) {
            q.ok(doc.properties['carmen:center'], 'carmen:center has been set');
            q.end();
        });
    });
    t.test('indexes doc with geometry and carmen:center', function(q) {
        index.update(conf.to, [{ id:1, type: 'Feature', properties: { 'carmen:text': 'main st', 'carmen:center': [-75.598211,38.367333] }, geometry:{ type: 'Point', coordinates: [-75.598211,38.367333]}}], { zoom: 6 }, function(err) {
            q.ifError(err);
            q.end();
        });
    });
    t.end();
});

test('index', function(t) {
    var inputStream = fs.createReadStream(path.resolve(__dirname, './fixtures/docs.jsonl'), { encoding: 'utf8' });

    var outputStream = new Stream.Writable();
    outputStream._write = function(chunk, encoding, done) {
        var doc = JSON.parse(chunk.toString());

        //Only print on error or else the logs are super long
        if (!doc.id) t.ok(doc.id, 'has id: ' + doc.id);
        done();
    };

    var memdocs = require('./fixtures/mem-docs.json');
    var conf = { to: new mem(memdocs, null, function() {}) }

    var carmen = new Carmen(conf);

    t.test('indexes a document', function(q) {
        carmen.index(inputStream, conf.to, {
            zoom: 6,
            output: outputStream
        }, function(err) {
            q.ifError(err);
            // Updates the mem.json fixture on disk.
            var memJson = __dirname + '/fixtures/mem-' + conf.to._dictcache.properties.type + '.json';
            if (UPDATE) fs.writeFileSync(memJson, JSON.stringify(conf.to.serialize(), null, 4));
            q.equal(JSON.stringify(conf.to.serialize()).length, JSON.stringify(require(memJson)).length);
            q.end();
        });
    });
    t.test('analyzes index', function(q) {
        carmen.analyze(conf.to, function(err, stats) {
            q.ifError(err);
            // Updates the mem-analyze.json fixture on disk.
            if (UPDATE) fs.writeFileSync(__dirname + '/fixtures/mem-analyze.json', JSON.stringify(stats, null, 4));
            q.deepEqual(require('./fixtures/mem-analyze.json'), stats);
            q.end();
        });
    });
    t.test('confirm that iterator works', function(q) {
        var monotonic = true;
        var output = [];
        var iterator = conf.to.geocoderDataIterator('freq');
        var next = function(err, n) {
            q.ifError(err);
            if (!n.done) {
                output.push(n.value.shard);
                if (output.length > 1) {
                    monotonic = monotonic && (output[output.length - 1] > output[output.length - 2])
                }
                iterator.asyncNext(next);
            } else {
                q.ok(monotonic, 'shard iterator produces sorted output');
                q.equal(output.length, 0, "index has 0 shards");
                q.end();
            }
        };
        iterator.asyncNext(next);
    });
    t.end();
});

test('error -- zoom too high', function(t) {
    var inputStream = fs.createReadStream(path.resolve(__dirname, './fixtures/docs.jsonl'), { encoding: 'utf8' });

    var outputStream = new Stream.Writable();
    outputStream._write = function(chunk, encoding, done) {
        var doc = JSON.parse(chunk.toString());

        //Only print on error or else the logs are super long
        if (!doc.id) t.ok(doc.id, 'has id: ' + doc.id);
        done();
    };


    var conf = {
        to: new mem([], null, function() {})
    };

    var carmen = new Carmen(conf);
    carmen.index(inputStream, conf.to, {
        zoom: 15,
        output: outputStream
    }, function(err) {
        t.equal('Error: zoom must be less than 15 --- zoom was 15', err.toString());
        t.end();
    });
});

test('error -- zoom too low', function(t) {
    var inputStream = fs.createReadStream(path.resolve(__dirname, './fixtures/docs.jsonl'), { encoding: 'utf8' });

    var outputStream = new Stream.Writable();
    outputStream._write = function(chunk, encoding, done) {
        var doc = JSON.parse(chunk.toString());

        //Only print on error or else the logs are super long
        if (!doc.id) t.ok(doc.id, 'has id: ' + doc.id);
        done();
    };

    var conf = {
        to: new mem([], null, function() {})
    };
    var carmen = new Carmen(conf);
    carmen.index(inputStream, conf.to, {
        zoom: -1,
        output: outputStream
    }, function(err) {
        t.equal('Error: zoom must be greater than 0 --- zoom was -1', err.toString());
        t.end();
    });
});

test('index phrase collection', function(assert) {
    var conf = { test:new mem(null, {maxzoom:6}, function() {}) };
    var c = new Carmen(conf);
    assert.ok(c);
    var docs = [{
        id:1,
        type: 'Feature',
        properties: {
            'carmen:text': 'a',
            'carmen:center': [0,0]
        },
        geometry: {
            type: 'Point',
            coordinates: [0,0]
        }
    }, {
        id:2,
        type: 'Feature',
        properties: {
            'carmen:text': 'a',
            'carmen:center': [0,0]
        },
        geometry: {
            type: 'Point',
            coordinates: [0,0]
        }
    }];
    index.update(conf.test, docs, { zoom: 6 }, afterUpdate);
    function afterUpdate(err) {
        assert.ifError(err);
        var id1 = termops.encodePhrase('a');
        assert.deepEqual(conf.test._geocoder.grid.list(), [ id1.toString() ], '1 phrase');
        assert.deepEqual(conf.test._geocoder.grid.get(id1), [ 6755949230424065, 6755949230424066 ], 'grid has 2 zxy+feature ids');
        assert.end();
    }
});

test('error -- _geometry too high resolution', function(t) {
    var docs = JSON.parse(fs.readFileSync(__dirname+'/fixtures/hugedoc.json'));

    var s = new Stream.Readable();
    s._read = function noop() {}; // redundant? see update below
    s.push(JSON.stringify(docs[0]) + '\n');
    s.push(null);

    var outputStream = new Stream.Writable();
    outputStream._write = function(chunk, encoding, done) {
        var doc = JSON.parse(chunk.toString());

        //Only print on error or else the logs are super long
        if (!doc.id) t.ok(doc.id, 'has id: ' + doc.id);
        done();
    };

    var conf = {
        to: new mem(docs, null, function() {})
    };

    var carmen = new Carmen(conf);
    carmen.index(s, conf.to, {
        zoom: 6,
        output: outputStream
    }, function(err) {
        t.equal('Error: Polygons may not have more than 50k vertices. Simplify your polygons, or split the polygon into multiple parts on id:1', err.toString());
        t.end();
    });
});

test('index.cleanDocs', function(assert) {
    var sourceWithAddress = {geocoder_address:true};
    var sourceWithoutAddress = {geocoder_address:false};

    assert.equal(typeof index.cleanDocs(sourceWithAddress, [{ geometry:{}} ])[0].geometry, 'object', 'with address: preserves geometry');
    assert.equal(typeof index.cleanDocs(sourceWithoutAddress, [{geometry:{}}])[0].geometry, 'undefined', 'without address: removes geometry');
    assert.equal(typeof index.cleanDocs(sourceWithAddress, [{geometry:{},properties: { 'carmen:addressnumber':{}} }])[0]._geometry, 'undefined', 'with carmen:addressnumber: preserves geometry');
    assert.end();
});

