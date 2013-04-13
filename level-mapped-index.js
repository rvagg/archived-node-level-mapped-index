const mapReduce       = require('map-reduce')
    , xtend           = require('xtend')
    , transformStream = require('transform-stream')

    , mapReducePrefix = 'mi/'

var register = function (db, indexName, indexer) {
      var emit = function (id, value, emit) {
            indexer(id, value, function (value) {
              emit(value, id)
            })
          }
        , mapper = mapReduce(db, mapReducePrefix + indexName, emit)

      db._mappedIndexes[indexName] = mapper
      return db
    }

  , indexedStream = function (db, indexName, key, options) {
      if (!db._mappedIndexes[indexName])
        throw new Error('No such index: ' + indexName)
      if (!options)
        options = {}
      options = xtend(options || {}, { range: [ String(key), '' ] })
      var stream = db._mappedIndexes[indexName]
        .createReadStream(options)
        .pipe(transformStream(function (data, finish) {
          db.get(data.value, function (err, value) {
            if (err) return finish()
            finish(null, { key: data.value, value: value })
          })
        }))
      stream.on('end', function () {
        process.nextTick(stream.emit.bind(stream, 'close'))
      })
      return stream
    }

  , getBy = function (db, indexName, key, callback) {
      var data = []
      db.createIndexedStream(indexName, key)
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

  , setup = function (db) {
      if (db._mappedIndexes) return

      db._mappedIndexes      = {}
      db.registerIndex       = register.bind(null, db)
      db.createIndexedStream = indexedStream.bind(null, db)
      db.getBy               = getBy.bind(null, db)

      return db
    }

module.exports = setup