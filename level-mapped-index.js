const mapReduce       = require('map-reduce')
    , xtend           = require('xtend')
    , transformStream = require('transform-stream')

var register = function (db, indexName, indexer) {
      var emit = function (id, value, emit) {
            indexer(id, value, function (value) {
              emit(value, id)
            })
          }
        , mapper = mapReduce(db, indexName, emit)

      if (!db.mappedIndexes)
        db.mappedIndexes = {}
      db.mappedIndexes[indexName] = mapper
      return db
    }

  , indexedStream = function (db, indexName, key, options) {
      if (!options)
        options = {}
      options = xtend(options || {}, { range: [ key, '' ] })
      var stream = db.mappedIndexes[indexName]
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
      var keys = [], values = []
      db.createIndexedStream(indexName, key)
        .on('data', function (data) {
          keys.push(data.key)
          values.push(data.value)
        })
        .on('error', function (err) {
          callback(err)
          callback = null
        })
        .on('close', function () {
          callback && callback(null, values, keys)
        })
    }

  , setup = function (db) {
      db.registerIndex       = register.bind(null, db)
      db.createIndexedStream = indexedStream.bind(null, db)
      db.getBy               = getBy.bind(null, db)
      return db
    }

module.exports = setup