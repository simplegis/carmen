var tape = require('tape');
var Carmen = require('..');
var context = require('../lib/context');
var mem = require('../lib/api-mem');
var addFeature = require('../lib/util/addfeature');

var conf = {
    country: new mem(null, function() {}),
    region: new mem(null, function() {}),
    place: new mem(null, function() {}),
    address: new mem({
        maxzoom: 6,
        geocoder_address: 1
    }, function() {})
};
var c = new Carmen(conf);

tape('index country', function(t) {
    var country = {
        id:1,
        properties: {
            'carmen:text':'United States',
            'carmen:zxy':['6/32/32'],
            'carmen:center':[0,0]
        }
    };
    addFeature(conf.country, country, t.end);
});

tape('index region', function(t) {
    var region = {
        id:2,
        properties: {
            'carmen:text':'North Carolina',
            'carmen:zxy':['6/32/32'],
            'carmen:center':[0,0]
        }
    };
    addFeature(conf.region, region, t.end);
});

tape('index place', function(t) {
    var place = {
        id:5,
        properties: {
            'carmen:text':'Winston-Salem',
            'carmen:zxy':['6/32/32'],
            'carmen:center':[0,0]
        }
    };
    addFeature(conf.place, place, t.end);
});

tape('index address', function(t) {
    var address = {
        id:6,
        properties: {
            'carmen:text':'Log Cabin Ln',
            'carmen:zxy':['6/32/32'],
            'carmen:center':[0,0],
            'carmen:addressnumber': ['1234']
        },
        geometry: {
            type: 'MultiPoint',
            coordinates: [[0,0],[0,0],[0,0]]
        }
    };
    addFeature(conf.address, address, t.end);
});

tape('Winston-Salem North Carolina', function(t) {
    c.geocode('Winston-Salem North Carolina', {limit_verify: 1}, function(err, res) {
        t.ifError(err);
        t.equal(res.features[0].text, "Winston-Salem", "ok when query is ordered `{place} {region}`")
        t.equal(res.features[0].relevance, 1, "Ascending order doesn't lower relevance");
        t.end();
    });
});

tape('North Carolina Winston-Salem', function(t) {
    c.geocode('North Carolina Winston-Salem', {limit_verify: 1}, function(err, res) {
        t.ifError(err);
        t.equal(res.features[0].text, "Winston-Salem", "ok when query is ordered `{region} {place}`");
        t.equal(res.features[0].relevance, 1, "Descending order doesn't lower relevance");
        t.end();
    });
});

tape('Log Cabin Ln North Carolina Winston-Salem', function(t) {
    c.geocode('Log Cabin Ln North Carolina Winston-Salem', {limit_verify: 1}, function(err, res) {
        t.ifError(err);
        t.equal(res.features[0].text, "Log Cabin Ln", "ok when query order is mixed up");
        t.equal(res.features[0].relevance, 0.7666666666666666, "Mixed-up order lowers relevance");
        t.end();
    });
});

tape('teardown', function(assert) {
    context.getTile.cache.reset();
    assert.end();
});