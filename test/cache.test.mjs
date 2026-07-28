import test from 'node:test'
import assert from 'node:assert/strict'
import Cache from '../src/index.js'

const makeStore = (initial = {}) => {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = value }
  }
}

const read = (cache, lng, ns) => {
  let result
  cache.read(lng, ns, (err, data, stamp) => { result = { err, data, stamp } })
  return result
}

test('a corrupt entry is a cache miss, not a thrown error', () => {
  const store = makeStore({ 'i18next_res_en-translation': 'not json{' })
  const cache = new Cache({}, { store })
  assert.deepEqual(read(cache, 'en', 'translation'), { err: null, data: null, stamp: undefined })
})

test('a stored primitive does not crash the read path', () => {
  for (const value of ['null', '5', '"str"', 'true']) {
    const store = makeStore({ 'i18next_res_en-translation': value })
    const cache = new Cache({}, { store })
    assert.equal(read(cache, 'en', 'translation').data, null, `value: ${value}`)
  }
})

test('save does not mutate the caller object', () => {
  const cache = new Cache({}, { store: makeStore() })
  const data = { hi: 'hello' }
  cache.save('en', 'translation', data)
  assert.deepEqual(data, { hi: 'hello' })
})

test('getVersion does not inherit from Object.prototype', () => {
  const cache = new Cache({}, { store: makeStore(), versions: { en: 'v1' } })
  assert.equal(cache.getVersion('en', 'translation'), 'v1')
  assert.equal(cache.getVersion('__proto__', 'translation'), undefined)
  assert.equal(cache.getVersion('toString', 'translation'), undefined)
})

test('round-trip still works and strips the storage metadata', () => {
  const store = makeStore()
  const cache = new Cache({}, { store, versions: { en: 'v1' } })
  cache.save('en', 'translation', { hi: 'hello' })

  const { data, stamp } = read(cache, 'en', 'translation')
  assert.deepEqual(data, { hi: 'hello' })
  assert.equal(typeof stamp, 'number')
})

test('a version mismatch invalidates the cached entry', () => {
  const store = makeStore()
  new Cache({}, { store, versions: { en: 'v1' } }).save('en', 'translation', { hi: 'hello' })

  const stale = new Cache({}, { store, versions: { en: 'v2' } })
  assert.equal(read(stale, 'en', 'translation').data, null)
})
