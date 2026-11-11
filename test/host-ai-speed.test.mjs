/**
 * Whole-lesson summary speed path: batches are read in parallel (bounded),
 * notes stay in page order, slide reading uses the model's cheapest reasoning
 * effort while the final synthesis uses "high", and a provider rate limit
 * lowers concurrency and retries instead of failing the job.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply } from '../index.js'

process.env.DSH_STUDY_COACH_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'study-coach-speed-'))

const SLIDE_COUNT = 30 // 5 batches of 6
const routes = new Map()
const config = {
  stateJson: JSON.stringify({ version: 1, createdAt: 1, updatedAt: 1, cards: [], daily: {}, streak: { lastDay: '', days: 0 } }),
  dailyGoal: 15,
  yktRegion: 'standard',
  yktAccount: '测试账号',
  yktSchool: '测试大学',
  aiProvider: 'magpie',
  aiModel: 'flash',
  aiReasoning: '',
}

let active = 0
let maxActive = 0
let rateLimitOnce = true
const readEfforts = []
const composeEfforts = []
let composePrompt = ''
let treeCalls = 0
const treeEfforts = []

const llm = {
  async listProviders() { return [{ id: 'magpie', name: 'Magpie' }] },
  async listModels() { return [{ id: 'flash', name: 'Flash', inputModalities: ['text', 'image'] }] },
  async resolveModelInfo(provider, model) {
    return {
      provider,
      id: model,
      inputModalities: ['text', 'image'],
      reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }, { id: 'max', name: 'Max' }] },
    }
  },
  async *stream(options) {
    const prompt = options.messages[0].content.filter((block) => block.type === 'text')[0].text
    if (/【当前知识看板】/.test(prompt)) {
      treeCalls += 1
      treeEfforts.push(options.reasoningEffort)
      const nextNode = /新节点 id 从 (n\d+) 开始/.exec(prompt)[1]
      const lines = treeCalls === 1
        ? ['```jsonl', '{"op":"tree","id":"t1","title":"极限"}', `{"op":"node","id":"${nextNode}","tree":"t1","parent":null,"label":"极限定义","pages":[1],"importance":"high"}`, '这一行是废话', '```']
        : treeCalls === 2
          ? ['{"op":"tree","id":"t2","title":"连续"}', `{"op":"node","id":"${nextNode}","tree":"t2","parent":null,"label":"连续性"}`, '{"op":"merge","from":"t2","into":"t1","parent":"n1"}']
          : [`{"op":"node","id":"${nextNode}","parent":"n1","label":"知识点${treeCalls}","pages":[${treeCalls * 6}]}`]
      const body = lines.join('\n')
      // Stream in small pieces that cut lines in half.
      for (let i = 0; i < body.length; i += 7) {
        await new Promise((resolve) => setTimeout(resolve, 5))
        yield { type: 'text-delta', text: body.slice(i, i + 7) }
      }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }
    if (/严格输出一个 JSON/.test(prompt)) {
      composeEfforts.push(options.reasoningEffort)
      composePrompt = prompt
      yield {
        type: 'text-delta',
        text: JSON.stringify({ title: 'T', overview: 'O', knowledgePoints: [{ name: 'K', detail: 'D', importance: 'high', page: 1 }], examPoints: [], pitfalls: [], studyPlan: [] }),
      }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }
    readEfforts.push(options.reasoningEffort)
    const range = /第 (\d+)–(\d+) 页图片/.exec(prompt)
    active += 1
    maxActive = Math.max(maxActive, active)
    try {
      await new Promise((resolve) => setTimeout(resolve, 40))
      if (rateLimitOnce && range && range[1] === '7') {
        rateLimitOnce = false
        yield { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', status: 429, message: 'slow down' } } }
        return
      }
      yield { type: 'text-delta', text: `NOTE[${range[1]}-${range[2]}]` }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } finally {
      active -= 1
    }
  },
}

let credentialRecord = { kind: 'grant', payload: { cookie: 'sessionid=abcdefgh12345678; csrftoken=csrf1; university_id=42' } }
let imageCounter = 0
const ctx = {
  fiber: { entry: { options: { id: 'study-coach' } } },
  effect(fn) { const dispose = fn(); return typeof dispose === 'function' ? dispose : () => {} },
  on() { return () => {} },
  get(name) {
    if (name === 'webServer') return { register(value) { routes.set(value.path, value); return () => routes.delete(value.path) } }
    if (name === 'credentials') {
      return {
        async readRecord() { return credentialRecord },
        async modifyRecord(_key, mutate) { credentialRecord = await mutate(credentialRecord); return credentialRecord },
        async deleteRecord() { credentialRecord = undefined },
      }
    }
    if (name === 'attachments') {
      return {
        imageLimits: { maxImageBytes: 5_000_000, maxImagesPerMessage: 20 },
        async saveImage(input) {
          imageCounter += 1
          return { attachmentId: 'img-' + imageCounter, mediaType: input.mediaType, bytes: input.data.byteLength, width: 800, height: 600 }
        },
      }
    }
    if (name === 'llm') return llm
    return undefined
  },
  settings: { configure() { return () => {} }, async update(_ns, patch) { Object.assign(config, patch) } },
  tools: { register() { return () => {} } },
  commands: { register() { return () => {} } },
  systemPrompt: { section() { return () => {} }, context() { return () => {} } },
}

function json(payload) {
  return { ok: true, status: 200, headers: { get: () => 'application/json', getSetCookie: () => [] }, text: async () => JSON.stringify(payload) }
}
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
globalThis.fetch = async (url) => {
  const parsed = new URL(String(url))
  if (parsed.pathname === '/api/v3/user/basic-info') return json({ code: 0, data: { user_id: 'u1', name: '测试账号', school: '测试大学' } })
  if (parsed.pathname === '/v2/api/web/userinfo') return json({ code: 0, data: [{ university_id: 42 }] })
  if (parsed.pathname === '/api/v3/classroom-report/student/lesson-info') {
    return json({ code: 0, data: { lessonId: 'L1', lessonName: '长课', courseName: '课程', presentationIds: ['P1'] } })
  }
  if (parsed.pathname === '/api/v3/lesson-summary/student') {
    return json({ code: 0, data: { presentations: [{ id: 'P1', title: '课件', slidesCount: SLIDE_COUNT }], lesson: { title: '长课' }, checkIn: null } })
  }
  if (parsed.pathname === '/api/v3/lesson-summary/student/presentation') {
    const slides = Array.from({ length: SLIDE_COUNT }, (_, i) => ({ id: 's' + (i + 1), index: i + 1, cover: `slides/${i + 1}.png` }))
    return json({ code: 0, data: { slides } })
  }
  if (parsed.pathname === '/api/v3/lesson-summary/replay') return json({ code: 0, data: { lessonDuration: 1, timeLine: [] } })
  if (parsed.pathname === '/api/v3/lesson-summary/query-lesson-mind-map') return json({ code: 0, data: null })
  if (parsed.pathname === '/api/v3/lesson-summary/query-lecture-note') return json({ code: 0, data: { list: [], taskStatus: 2 } })
  if (parsed.hostname === 'qn-scd1.yuketang.cn') {
    return { ok: true, status: 200, headers: { get: () => 'image/png', getSetCookie: () => [] }, arrayBuffer: async () => png.slice().buffer }
  }
  throw new Error('unexpected URL ' + url)
}

apply(ctx, config)
const trusted = { 'x-dsh-ykt-bridge': '1', host: '127.0.0.1:1', origin: 'http://127.0.0.1:1', 'sec-fetch-site': 'same-origin' }
async function call(pathWithQuery, method = 'GET', body = '') {
  const route = routes.get('/api/local/dsh-ykt-study/' + pathWithQuery.split('?')[0])
  const res = { status: 0, body: '', writeHead(status) { this.status = status }, end(text) { this.body = text } }
  const chunks = body ? [Buffer.from(body)] : []
  await route.handler({ url: '/api/local/dsh-ykt-study/' + pathWithQuery, method, headers: trusted, socket: { remoteAddress: '127.0.0.1' }, async *[Symbol.asyncIterator]() { yield* chunks } }, res)
  return JSON.parse(res.body)
}

const started = Date.now()
assert.equal((await call('summary/start', 'POST', JSON.stringify({ lessonId: 'L1', force: true }))).ok, true)
let job = null
let sawLiveBoard = false
for (let attempt = 0; attempt < 600; attempt += 1) {
  job = (await call('summary/status?lessonId=L1')).data.job
  if (job && job.status === 'running' && job.board && Object.keys(job.board.nodes).length) sawLiveBoard = true
  if (job && job.status !== 'queued' && job.status !== 'running') break
  await new Promise((resolve) => setTimeout(resolve, 20))
}
assert.equal(job.status, 'done', 'summary completes despite one rate limit: ' + job.error)
assert.equal(job.readSlides, SLIDE_COUNT)

assert.ok(maxActive > 1, `batches are read in parallel (max ${maxActive})`)
assert.ok(maxActive <= 3, `parallel reads are bounded (max ${maxActive})`)
assert.equal(readEfforts.length, 6, '5 batches + 1 rate-limited retry')
assert.ok(readEfforts.every((effort) => effort === 'low'), 'slide reading uses the cheapest effort')
assert.deepEqual(composeEfforts, ['high'], 'synthesis uses high effort')

const order = [...composePrompt.matchAll(/NOTE\[(\d+)-\d+\]/g)].map((match) => Number(match[1]))
assert.deepEqual(order, [1, 7, 13, 19, 25], 'notes reach the synthesis in page order')

// Knowledge board: grown while reading, streamed, merged, saved with the summary.
assert.ok(sawLiveBoard, 'board is visible in status polls while the summary is still running')
assert.equal(treeCalls >= 1 && treeCalls <= 5, true, `tree calls coalesce batches (${treeCalls})`)
assert.ok(treeEfforts.every((effort) => effort === 'low'), 'tree growth uses the cheap effort')
const board = job.result.board
assert.ok(board, 'board is saved inside the summary')
assert.deepEqual(board.trees.map((tree) => tree.id), ['t1'], 'related tree t2 was merged into t1')
assert.equal(board.nodes.n2.tree, 't1')
assert.equal(board.nodes.n2.parent, 'n1', 'merged tree hangs under the anchor node')
assert.equal(Object.keys(board.nodes).length, treeCalls, 'one node per tree call, junk lines ignored')
assert.equal(job.board, null, 'finished jobs carry the board only inside result')

console.log(`host-ai-speed.test.mjs — parallel summary assertions passed (max ${maxActive} in flight, ${Date.now() - started} ms)`)
process.exit(0)
