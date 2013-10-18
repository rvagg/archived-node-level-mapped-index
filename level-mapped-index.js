const mapReduce       = require('map-reduce')
    , xtend           = require('xtend')
    , through2        = require('through2')

    , mapReducePrefix = 'mi/'

function register (db, mapDb, indexName, indexer, reducer, initial) {
  if (typeof indexName == 'function') {
    initial = reducer
    reducer = indexer
    indexer = indexName

    if (typeof mapDb == 'string') {
      indexName = mapDb
      mapDb = mapReducePrefix + mapDb
    } else
      indexName = mapDb._prefix
  }

  function emit (id, value, _emit) {
    indexer(id, value, function(key, value2) {
      _emit(key, value2);
    })
  }

  var mapper = mapReduce(db, mapDb, emit, reducer, initial)
  db._mappedIndexes[indexName] = typeof mapDb == 'string' ?  mapper : mapDb

  return db
}

function indexedStream (db, indexName, key, options) {
  if (!db._mappedIndexes[indexName])
    throw new Error('No such index: ' + indexName)

  if (!options)
    options = {}

  options = xtend(options || {}, { range: [ String(key), '' ] })

  var stream = db._mappedIndexes[indexName]
    .createReadStream(options)
    .pipe(through2({ objectMode: true }, function (data, enc, callback) {
      var arr = data.key.split('!'),
          id = arr[arr.length - 1];
      db.get(id, function (err, value) {
        if (err)
          return callback(err)
        callback(null, { key: data.value, value: value })
      })
    }))

  stream.on('end', function () {
    process.nextTick(stream.emit.bind(stream, 'close'))
  })

  return stream
}

function getBy (db, indexName, key, options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = null;
  }
  var data = []
  db.createIndexedStream(indexName, key, options)
    .on('data', function (_data) {
      data.push(_data)
    })
    .on('error', function (err) {
      callback(err)
      callback = null
    })
    .on('close', function () {
      callback && callback(null, data)
    })
}

function setup (db) {
  if (db._mappedIndexes) return db;

  db._mappedIndexes      = {}
  db.registerIndex       = register.bind(null, db)
  db.createIndexedStream = indexedStream.bind(null, db)
  db.getBy               = getBy.bind(null, db)

  return db
}

module.exports = setup