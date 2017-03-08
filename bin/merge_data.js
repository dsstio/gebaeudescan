"use strict"

const fs = require('fs');
const zlib = require('zlib');

var schulen = csv('gesamtkosten');
var prio1 = csv('prio1');
var meta = csv('meta');

// Merge mit Prio 1

var lookup = new Map();
schulen.forEach(schule => {
	var id = schule.bsn;
	if (lookup.has(id)) throw Error();
	lookup.set(id, schule);
})
prio1.forEach(schule1 => {
	var id = schule1.bsn;
	if (!lookup.has(id)) throw Error();
	var schule2 = lookup.get(id);
	Object.keys(schule1).forEach(key => {
		if (schule2[key] && (schule1[key] !== schule2[key])) throw Error([key, schule1[key], schule2[key]].join('\t'));
	})
	if (!schule2.prio1) schule2.prio1 = [];
	schule2.prio1.push(schule1);
})

// Merge mit Adressen

var lookup = new Map();
meta.forEach(entry => {
	var id = entry.bsn;
	lookup.set(id, entry);
})
schulen.forEach(schule => {
	var id = schule.bsn;
	if (!lookup.has(id)) return console.log(id);
	var entry = lookup.get(id);
	schule.x = parseFloat(entry.x);
	schule.y = parseFloat(entry.y);
	schule.type = entry.type;
})

// Export vorbereiten

schulen.forEach(schule => {
	schule.nr = parseInt(schule.nr, 10);
	schule.gesamtkosten = parseFloat(schule.gesamtkosten.replace(/[€']+/g,''));

	delete schule.nr;
	delete schule.bezirk;

	if (!schule.prio1) return schule.prio1 = false;

	var sum = 0;
	schule.prio1.forEach(prio => {
		sum += parseFloat(prio.prio1kosten.replace(/[€']+/g,''))
	})
	schule.prio1 = sum;
})

var markers = [];
schulen.forEach(schule => {
	var marker = false;
	markers.forEach(m => {
		var r = Math.sqrt(sqr(m.x - schule.x) + sqr(m.y - schule.y));
		if (r < 0.0001) marker = m;
	})

	if (!marker) {
		marker = {x:schule.x, y:schule.y, schulen:[]};
		markers.push(marker);
	}

	marker.schulen.push(schule);
})
markers.forEach(m => {
	var x = 0;
	var y = 0;
	var n = 0;

	m.schulen.forEach(s => {
		x += s.x;
		y += s.y;
		n++;
		if (s.prio1) m.prio1 = true;
	})

	m.x = x/n;
	m.y = y/n;
})

markers.sort((a,b) => (sqr(b.x - 52.517) + sqr(b.y - 13.39)) - (sqr(a.x - 52.517) + sqr(a.y - 13.39)))

function sqr(v) { return v*v }



var results = markers;
results = JSON.stringify(results);
results = Buffer.from(results, 'utf8');

fs.writeFileSync('../web/assets/marker.json', results);

results = zlib.gzipSync(results, {level:9});
fs.writeFileSync('../web/assets/marker.json.gz', results);



function csv(filename) {
	var filename = '../data/'+filename+'.tsv';
	var data = fs.readFileSync(filename, 'utf8');
	data = data.split('\n').filter(l => l.trim().length > 0).map(l => l.split('\t'));
	var header = data.shift();
	data = data.map(line => {
		var obj = {};
		header.forEach((key, index) => {
			obj[key] = line[index];
		})
		return obj;
	})
	return data;
}

function arrayOfObjects2ObjectOfArray (list) {
	if (list.length === 0) return null;
	var keys = new Set();
	list.forEach(
		entry => Object.keys(entry).forEach(
			key => keys.add(key)
		)
	);
	var obj = {};
	Array.from(keys.values()).forEach(key => {
		obj[key] = list.map(entry => entry.hasOwnProperty(key) ? entry[key] : null);
	})
	return obj;
}