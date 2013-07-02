# Mapped Index for LevelDB [![Build Status](https://secure.travis-ci.org/rvagg/node-level-mapped-index.png)](http://travis-ci.org/rvagg/node-level-mapped-index)

![LevelDB Logo](https://twimg0-a.akamaihd.net/profile_images/3360574989/92fc472928b444980408147e5e5db2fa_bigger.png)

A simple and flexible indexer for LevelDB, built on [LevelUP](https://github.com/rvagg/node-levelup) and [Map Reduce](https://github.com/dominictarr/map-reduce/); allowing asynchronous index calculation.	

After initialising Mapped Index, your LevelUP instance will have some new methods that let you register new indexes and fetch values from them.

```js
// requires levelup and level-sublevel packages
const levelup     = require('levelup')
    , mappedIndex = require('level-mapped-index')
    , sublevel    = require('level-sublevel')

levelup('/tmp/foo.db', function (err, db) {

  // set up our LevelUP instance
  db = sublevel(db)
  db = mappedIndex(db)

  // register 2 indexes:

  // first index is named 'id' and indexes the 'id' property
  // of each entry
  db.registerIndex('id', function (key, value, emit) {
    value = JSON.parse(value)
    // if the value has a property 'id', register this entry
    // by calling emit() with just the indexable value
    if (value.id) emit(value.id)
  })

  // second index is named 'bleh' and indexes the 'bleh' property
  db.registerIndex('bleh', function (key, value, emit) {
    value = JSON.parse(value)
    // in this case we're just going to index any entries that have a
    // 'boom' property equal to 'bam!'
    if (value.boom == 'bam!') emit(String(value.boom))
  })

  // ... use the database
})
```

In this example we're using the `registerIndex()` method to register two indexes. You must supply an index name (String) and a function that will parse and register individual entries for this index. Your function receives the key and the value of the entry and an `emit()` function. You call `emit()` with a single argument, the property for this entry that you are indexing on. The `emit()` function *does not need to be called* for each entry, only entries relevant to your index.

Note that the register method has the signature: <b><code>registerIndex([ mapDb, ] indexName, indexFn)</code></b>. So you can provide your own custom *sublevel* or even a totally separate LevelUP instance to store the indexing data if that suits your needs (perhaps you're a little OCD about polluting your main store with map-reduce & index cruft?)

Now we put some values into our database:

```js
db.put('foo1', JSON.stringify({ one   : 'ONE'   , id : '1' }))
db.put('foo2', JSON.stringify({ two   : 'TWO'   , id : '2' , boom: 'bam!' }))
db.put('foo3', JSON.stringify({ three : 'THREE' , id : '3' , boom: 'bam!' }))
db.put('foo4', JSON.stringify({ four  : 'FOUR'  , id : '4' , boom : 'fizzle...' }))
```

*Map Reduce* processes these entries and passes them each to our index functions that we registered earlier. Our index references are stored in the same database, namespaced, so that they can be efficiently retrieved when required:

```js
db.getBy('id', '1', function (err, data) {
  // `data` will equal:
  //    [{ key: 'foo1', value: '{"one":"ONE","key":"1"}' }]
})

db.getBy('bleh', 'bam!', function (err, data) {
  // `data` will equal:
  // [
  //     { key: 'foo2', value: '{"two":"TWO","key":"2","boom":"bam!"}' }
  //   , { key: 'foo3', value: '{"three":"THREE","key":"3","boom":"bam!"}' }
  // ]
})
```

Our LevelUP instance has been augmented with a `getBy()` method that takes 3 arguments: the index name, the value on that index we are looking for and a callback function. Our callback will receive two arguments, an error and an array of objects containing `'key'` and `'value'` properties for each indexed entry. You will receive empty arrays where your indexed value finds no corresponding entries.

It is **important to note** that your entries are not stored in duplicate, only the primary keys are stored for each index entry so an additional look-up is required to fetch each complete entry.

You can also ask for a stream of your indexed entries in a similar manner:

```js
db.createIndexedStream('id', '1')
  .on('data', function (data) {
    // this will be called once, and data will equal:
    // { key: 'foo1', value: '{"one":"ONE","key":"1"}' }
  })
  .on('error', function () {
    // ...
  })
  .on('end', function () {
    // ...
  })

db.createIndexedStream('key', '1')
  .on('data', function (data) {
    // this will be called twise, and data will equal:
    // { key: 'foo2', value: '{"two":"TWO","key":"2","boom":"bam!"}' }
    // { key: 'foo3', value: '{"three":"THREE","key":"3","boom":"bam!"}' }
  })
  .on('error', function () {
    // ...
  })
  .on('end', function () {
    // ...
  })
```

Of course this method is preferable if you are likely to have a large number of entries for each index value, otherwise `getBy()` will buffer each entry before returning them to you on the callback.

## Licence

level-mapped-index is Copyright (c) 2013 Rod Vagg [@rvagg](https://twitter.com/rvagg) and licensed under the MIT licence. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE file for more details.
