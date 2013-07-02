const test        = require('tap').test
    , levelup     = require('level')
    , sublevel    = require('level-sublevel')
    , rimraf      = require('rimraf')
    , after       = require('after')
    , delayed     = require('delayed').delayed
    , mappedIndex = require('./')

function writeTestData (db, cb) {
  db.put('foo1', JSON.stringify({'one':'ONE','key':'1'}), cb)
  db.put('foo2', JSON.stringify({'two':'TWO','key':'2','bleh':true}), cb)
  db.put('foo3', JSON.stringify({'three':'THREE','key':'3','bleh':true}), cb)
  db.put('foo4', JSON.stringify({'four':'FOUR','key':'4'}), cb)
}

function verifyGetBy (t, db, cb) {
  db.getBy('key', '1', function (err, data) {
    t.notOk(err, 'no error')

    t.deepEqual(data, [{
          key   : 'foo1'
        , value : '{"one":"ONE","key":"1"}'
    }], 'correct values')

    cb()
  })

  db.getBy('bleh', 'true', function (err, data) {
    t.notOk(err, 'no error')

    t.deepEqual(data, [
        { key: 'foo2', value: '{"two":"TWO","key":"2","bleh":true}' }
      , { key: 'foo3', value: '{"three":"THREE","key":"3","bleh":true}' }
    ], 'correct values')

    cb()
  })
}

function verifyStream (t, db, cb) {
  var i = 0, j = 0

  db.createIndexedStream('key', '1')
    .on('data', function (data) {
      t.ok(i++ === 0, 'first and only entry')
      t.equal(data.key, 'foo1', 'correct key')
      t.equal(data.value, '{"one":"ONE","key":"1"}', 'correct value')
    })
    .on('error', function (err) {
      t.notOk(err, 'got error from stream')
    })
    .on('end', function () {
      i = -1
    })
    .on('close', function () {
      t.equal(i, -1, '"end" was emitted')
      cb()
    })

  db.createIndexedStream('bleh', 'true')
    .on('data', function (data) {
      t.ok(j++ < 2, 'only two entries')
      t.equal(data.key, j == 1 ? 'foo2' : 'foo3', 'correct key')
      t.equal(
          data.value
        , j == 1
            ? '{"two":"TWO","key":"2","bleh":true}'
            : '{"three":"THREE","key":"3","bleh":true}'
        , 'correct value'
      )
    })
    .on('error', function (err) {
      t.notOk(err, 'got error from stream')
    })
    .on('end', function () {
      j = -1
    })
    .on('close', function () {
      t.equal(j, -1, '"end" was emitted')
      cb()
    })
}

test('test simple index', function (t) {
  var location = '__mapped-index-' + Math.random()
  levelup(location, function (err, db) {
    t.notOk(err, 'no error')

    db = sublevel(db)
    db = mappedIndex(db)

    var end = after(4, function () {
          rimraf(location, t.end.bind(t))
        })

      , cb = after(4, delayed(function (err) {
          t.notOk(err, 'no error')
          verifyGetBy(t, db, end)
          verifyStream(t, db, end)
        }, 0.1))

    db.registerIndex('key', function (id, value, emit) {
      value = JSON.parse(value)
      if (value.key)
        emit(value.key)
    })

    db.registerIndex('bleh', function (id, value, emit) {
      value = JSON.parse(value)
      if (value.bleh)
        emit(String(value.bleh))
    })

    writeTestData(db, cb)
  })
})

test('test index with sublevel mapDb', function (t) {
  var location = '__mapped-index-' + Math.random()
  levelup(location, function (err, db) {
    t.notOk(err, 'no error')

    db = sublevel(db)
    db = mappedIndex(db)
    var idxdb = db.sublevel('indexsublevel')
      , end = after(4, function () {
          rimraf(location, t.end.bind(t))
        })

      , cb = after(4, delayed(function (err) {
          t.notOk(err, 'no error')
          verifyGetBy(t, db, end)
          verifyStream(t, db, end)
        }, 0.1))

    // this index is to be stored in a sublevel
    db.registerIndex(idxdb, 'key', function (id, value, emit) {
      value = JSON.parse(value)
      if (value.key)
        emit(value.key)
    })

    db.registerIndex('bleh', function (id, value, emit) {
      value = JSON.parse(value)
      if (value.bleh)
        emit(String(value.bleh))
    })

    writeTestData(db, cb)
  })
})

test('test index with sublevel mapDb, no name', function (t) {
  var location = '__mapped-index-' + Math.random()
  levelup(location, function (err, db) {
    t.notOk(err, 'no error')

    db = sublevel(db)
    db = mappedIndex(db)
    var idxdb = db.sublevel('key') // index name comes from sublevel
      , end = after(4, function () {
          rimraf(location, t.end.bind(t))
        })

      , cb = after(4, delayed(function (err) {
          t.notOk(err, 'no error')
          verifyGetBy(t, db, end)
          verifyStream(t, db, end)
        }, 0.1))

    // this index is to be stored in a sublevel, no index name provided
    db.registerIndex(idxdb, function (id, value, emit) {
      value = JSON.parse(value)
      if (value.key)
        emit(value.key)
    })

    db.registerIndex('bleh', function (id, value, emit) {
      value = JSON.parse(value)
      if (value.bleh)
        emit(String(value.bleh))
    })

    writeTestData(db, cb)
  })
})

test('test index with separate mapDb', function (t) {
  var location1 = '__mapped-index-' + Math.random()
    , location2 = '__mapped-index-' + Math.random()
  levelup(location1, function (err, db) {
    t.notOk(err, 'no error')
    levelup(location2, function (err, idxdb) {
      t.notOk(err, 'no error')

      db = sublevel(db)
      idxdb = sublevel(idxdb)
      db = mappedIndex(db)
      var end = after(4, function () {
            rimraf(location1, function () {
              rimraf(location2, t.end.bind(t))
            })
          })

        , cb = after(4, delayed(function (err) {
            t.notOk(err, 'no error')
            verifyGetBy(t, db, end)
            verifyStream(t, db, end)
          }, 0.1))

      // this index is to be stored in a separate db
      db.registerIndex(idxdb, 'key', function (id, value, emit) {
        value = JSON.parse(value)
        if (value.key)
          emit(value.key)
      })

      db.registerIndex('bleh', function (id, value, emit) {
        value = JSON.parse(value)
        if (value.bleh)
          emit(String(value.bleh))
      })

      writeTestData(db, cb)
    })
  })
})