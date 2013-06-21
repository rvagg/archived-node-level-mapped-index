const test        = require('tap').test
    , levelup     = require('level')
    , subLevel    = require('level-sublevel')
    , rimraf      = require('rimraf')
    , after       = require('after')
    , delayed     = require('delayed').delayed
    , mappedIndex = require('./')

test('test simple index', function (t) {
  var location = '__mapped-index-' + Math.random()
  levelup(location, function (err, db) {
    t.notOk(err, 'no error')

    db = subLevel(db)
    db = mappedIndex(db)

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

    var end = after(4, function () {
          rimraf(location, t.end.bind(t))
        })

      , cb = after(4, delayed(function (err) {
          var i = 0, j = 0

          t.notOk(err, 'no error')

          db.getBy('key', '1', function (err, data) {
            t.notOk(err, 'no error')

            t.deepEqual(data, [{
                  key   : 'foo1'
                , value : '{"one":"ONE","key":"1"}'
            }], 'correct values')

            end()
          })

          db.getBy('bleh', 'true', function (err, data) {
            t.notOk(err, 'no error')

            t.deepEqual(data, [
                { key: 'foo2', value: '{"two":"TWO","key":"2","bleh":true}' }
              , { key: 'foo3', value: '{"three":"THREE","key":"3","bleh":true}' }
            ], 'correct values')

            end()
          })

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
              end()
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
              end()
            })
        }, 0.05))

    db.put('foo1', JSON.stringify({'one':'ONE','key':'1'}), cb)
    db.put('foo2', JSON.stringify({'two':'TWO','key':'2','bleh':true}), cb)
    db.put('foo3', JSON.stringify({'three':'THREE','key':'3','bleh':true}), cb)
    db.put('foo4', JSON.stringify({'four':'FOUR','key':'4'}), cb)
  })
})
