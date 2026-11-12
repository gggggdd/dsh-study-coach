/**
 * Test the plugin's local HTTP bridge used by the Web panel: exact route
 * registration, trusted-origin enforcement, status, login and QR polling.
 */
import assert from 'node:assert/strict'
import { apply } from '../index.js'

const routes = new Map()
let credentialRecord = undefined
const config = {
  stateJson: undefined,
  dailyGoal: 15,
  yktRegion: 'standard',
  yktAccount: '',
  yktSchool: '',
}

const ctx = {
  fiber: { entry: { options: { id: 'study-coach' } } },
  effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {} },
  on() { return () => {} },
  get(name) {
    if (name === 'webServer') {
      return {
        register(value) {
          routes.set(value.path, value)
          return () => routes.delete(value.path)
        },
      }
    }
    if (name === 'credentials') {
      return {
        async readRecord() { return credentialRecord },
        async modifyRecord(_key, mutate) { credentialRecord = await mutate(credentialRecord); return credentialRecord },
        async deleteRecord() { credentialRecord = undefined },
      }
    }
    return undefined
  },
  settings: {
    configure() { return () => {} },
    async update(_ns, patch) { Object.assign(config, patch) },
  },
  tools: { register() { return () => {} } },
  commands: { register() { return () => {} } },
  systemPrompt: { section() { return () => {} }, context() { return () => {} } },
}

globalThis.fetch = async (url) => {
  if (String(url).endsWith('/api/v3/user/basic-info')) {
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ code: 0, data: { user_id: 'u1', name: '小同', school: '湖南工学院' } }) }
  }
  if (String(url).endsWith('/api/v3/user/login/app-web-pre-info')) {
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ code: 0, data: { qrContent: 'https://www.yuketang.cn/api/v3/user/login/app-web-qr?u=abc', token: 'qr-token-1' } }) }
  }
  if (String(url).endsWith('/api/v3/user/login/app-web-login')) {
    return {
      ok: true,
      status: 200,
      headers: { getSetCookie: () => ['sessionid=abcdefgh12345678; Path=/; HttpOnly'] },
      get: () => null,
      text: async () => JSON.stringify({ code: 0, data: { UserID: 'u1', Name: '小同' } }),
    }
  }
  throw new Error('unexpected URL ' + url)
}

apply(ctx, config)
assert.equal(routes.size, 23, 'twenty-three exact bridge routes registered')
assert.ok(routes.has('/api/local/dsh-ykt-study/slide-image'), 'slide-image route registered')
assert.ok(routes.has('/api/local/dsh-ykt-study/status'), 'status route registered')
assert.ok(routes.has('/api/local/dsh-ykt-study/qr/poll'), 'qr/poll route registered')
assert.ok(routes.has('/api/local/dsh-ykt-study/models'), 'models route registered')
assert.ok(routes.has('/api/local/dsh-ykt-study/summary/start'), 'summary/start route registered')
assert.ok(routes.has('/api/local/dsh-ykt-study/page-chat'), 'page-chat route registered')
assert.ok(routes.has('/api/local/dsh-ykt-study/board-chat'), 'board-chat route registered')

function request(url, method = 'GET', headers = {}, body = '') {
  const chunks = body ? [Buffer.from(body)] : []
  return {
    url,
    method,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() { yield* chunks },
  }
}

function response() {
  return {
    status: 0,
    body: '',
    writeHead(status) { this.status = status },
    end(text) { this.body = text },
  }
}

async function call(url, method = 'GET', headers = {}, body = '') {
  const pathname = new URL(url, 'http://localhost').pathname
  const handler = routes.get(pathname)
  assert.ok(handler, `route exists for ${pathname}`)
  const res = response()
  await handler.handler(request(url, method, headers, body), res)
  return { status: res.status, body: res.body ? JSON.parse(res.body) : null }
}

const trusted = {
  'x-dsh-ykt-bridge': '1',
  host: '127.0.0.1:53957',
  origin: 'http://127.0.0.1:53957',
  'sec-fetch-site': 'same-origin',
}

const status = await call('/api/local/dsh-ykt-study/status', 'GET', trusted)
assert.equal(status.status, 200)
assert.equal(status.body.data.loggedIn, false)

const untrusted = await call('/api/local/dsh-ykt-study/status')
assert.equal(untrusted.status, 403)

const login = await call('/api/local/dsh-ykt-study/login', 'POST', trusted, JSON.stringify({ sessionid: 'abcdefgh12345678', region: 'standard' }))
assert.equal(login.status, 200)
assert.equal(login.body.ok, true)
assert.equal(login.body.data.loggedIn, true)
assert.equal(credentialRecord.payload.sessionid, 'abcdefgh12345678')
assert.equal(config.yktAccount, '小同')

const fullCookieLogin = await call('/api/local/dsh-ykt-study/login', 'POST', trusted, JSON.stringify({
  cookie: 'sessionid=abcdefgh12345678; csrftoken=csrf-token; university_id=77',
  region: 'standard',
}))
assert.equal(fullCookieLogin.body.ok, true)
assert.match(credentialRecord.payload.cookie, /csrftoken=csrf-token/)
assert.doesNotMatch(credentialRecord.payload.cookie, /^csrf-token$/)

const qr = await call('/api/local/dsh-ykt-study/qr', 'POST', trusted, JSON.stringify({ region: 'standard' }))
assert.equal(qr.status, 200)
assert.equal(qr.body.data.token, 'qr-token-1')
assert.match(qr.body.data.qrContent, /app-web-qr/)

credentialRecord = undefined
const poll = await call('/api/local/dsh-ykt-study/qr/poll', 'POST', trusted, JSON.stringify({ token: 'qr-token-1' }))
assert.equal(poll.status, 200)
assert.equal(poll.body.ok, true)
assert.equal(poll.body.data.status, 'success')
assert.equal(credentialRecord.payload.sessionid, 'abcdefgh12345678')

console.log('host-route.test.mjs — route assertions passed')
process.exit(0)
