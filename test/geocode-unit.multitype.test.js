// Test multitype behavior

var tape = require('tape');
var Carmen = require('..');
var context = require('../lib/context');
var mem = require('../lib/api-mem');
var addFeature = require('../lib/util/addfeature');

var conf = {
    region: new mem({maxzoom:6, geocoder_types:['region','place']}, function() {}),
    place: new mem({maxzoom:6}, function() {}),
    poi: new mem({maxzoom:6}, function() {})
};
var c = new Carmen(conf);

tape('index region', function(t) {
    addFeature(conf.region, {
        id:1,
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [-40,-40],
                [-40,40],
                [40,40],
                [40,-40],
                [-40,-40]
            ]]
        },
        properties: {
            'carmen:types': ['region', 'place'],
            'carmen:text': 'caracas',
            'carmen:center': [0,0]
        }
    }, t.end);
});

tape('index place', function(t) {
    addFeature(conf.place, {
        id:1,
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [-40,-40],
                [-40,40],
                [40,40],
                [40,-40],
                [-40,-40]
            ]]
        },
        properties: {
            'carmen:text': 'libertador',
            'carmen:center': [0,0]
        }
    }, t.end);
});

tape('index poi', function(t) {
    addFeature(conf.poi, {
        id:1,
        geometry: {
            type: 'Point',
            coordinates: [0,0]
        },
        properties: {
            'carmen:text': 'cafe',
            'carmen:center': [0,0]
        }
    }, t.end);
});

tape('multitype reverse', function(assert) {
    assert.comment('query:  0,0');
    assert.comment('result: cafe, libertador, caracas');
    assert.comment('note:   returns full context, no shifts');
    c.geocode('0,0', {}, function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res.features[0].place_name, 'cafe, libertador, caracas');
        assert.deepEqual(res.features[0].id, 'poi.1');
        assert.deepEqual(res.features[0].context, [{
            id: 'place.1',
            text: 'libertador'
        }, {
            id: 'region.1',
            text: 'caracas'
        }]);
        assert.end();
    });
});

tape('multitype reverse, types=poi', function(assert) {
    assert.comment('query:  0,0');
    assert.comment('result: cafe, libertador, caracas');
    assert.comment('note:   returns full context, no shifts');
    c.geocode('0,0', {types:['poi']}, function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res.features[0].place_name, 'cafe, libertador, caracas');
        assert.deepEqual(res.features[0].id, 'poi.1');
        assert.deepEqual(res.features[0].context, [{
            id: 'place.1',
            text: 'libertador'
        }, {
            id: 'region.1',
            text: 'caracas'
        }]);
        assert.end();
    });
});

tape('multitype reverse, types=place', function(assert) {
    assert.comment('query:  0,0');
    assert.comment('result: caracas');
    assert.comment('note:   returns caracas with shift');
    c.geocode('0,0', {types:['place']}, function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res.features[0].place_name, 'caracas');
        assert.deepEqual(res.features[0].id, 'place.1');
        assert.end();
    });
});

tape('multitype reverse, types=region', function(assert) {
    assert.comment('query:  0,0');
    assert.comment('result: caracas');
    assert.comment('note:   returns caracas, no shift');
    c.geocode('0,0', {types:['region']}, function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res.features[0].place_name, 'caracas');
        assert.deepEqual(res.features[0].id, 'region.1');
        assert.end();
    });
});

tape('multitype reverse, types=place,region', function(assert) {
    assert.comment('query:  0,0');
    assert.comment('result: caracas');
    assert.comment('note:   returns caracas with');
    c.geocode('0,0', {types:['place','region']}, function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res.features[0].place_name, 'caracas');
        assert.deepEqual(res.features[0].id, 'place.1');
        assert.end();
    });
});

tape('multitype forward, q=cafe', function(assert) {
    assert.comment('query:  cafe');
    assert.comment('result: cafe, libertador, caracas');
    assert.comment('note:   returns full context, no shifts');
    c.geocode('cafe', {}, function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res.features[0].place_name, 'cafe, libertador, caracas');
        assert.deepEqual(res.features[0].id, 'poi.1');
        assert.deepEqual(res.features[0].context, [{
            id: 'place.1',
            text: 'libertador'
        }, {
            id: 'region.1',
            text: 'caracas'
        }]);
        assert.end();
    });
});

tape('multitype forward, q=libertador', function(assert) {
    assert.comment('query:  libertador');
    assert.comment('result: libertador, caracas');
    assert.comment('note:   returns full context, no shifts');
    c.geocode('libertador', {}, function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res.features[0].place_name, 'libertador, caracas');
        assert.deepEqual(res.features[0].id, 'place.1');
        assert.deepEqual(res.features[0].context, [{
            id: 'region.1',
            text: 'caracas'
        }]);
        assert.end();
    });
});

tape('multitype forward, q=caracas', function(assert) {
    assert.comment('query:  caracas');
    assert.comment('result: caracas');
    assert.comment('note:   returns caracas with shift');
    c.geocode('caracas', {}, function(err, res) {
        assert.ifError(err);
        assert.deepEqual(res.features[0].place_name, 'caracas');
        assert.deepEqual(res.features[0].id, 'place.1');
        assert.end();
    });
});

tape('teardown', function(assert) {
    context.getTile.cache.reset();
    assert.end();
});

