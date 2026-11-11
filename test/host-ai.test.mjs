/**
 * Host-side AI integration: model catalog, model override, whole-lesson summary
 * job (all slides -> partial notes -> structured summary), summary cards and
 * per-slide chat. Uses fake `llm` + fake Yuketang HTTP responses.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply } from '../index.js'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-coach-ai-'))
process.env.DSH_STUDY_COACH_DATA = dataDir

const routes = new Map()
const config = {
  stateJson: JSON.stringify({ version: 1, createdAt: 1, updatedAt: 1, cards: [], daily: {}, streak: { lastDay: '', days: 0 } }),
  dailyGoal: 15,
  yktRegion: 'standard',
  yktAccount: '测试账号',
  yktSchool: '测试大学',
  aiProvider: '',
  aiModel: '',
  aiReasoning: '',
}

let imageCounter = 0
const savedImages = []
let lastBoardChat = null

const llm = {
  async listProviders() {
    return [
      { id: 'magpie', name: 'Magpie' },
      { id: 'text-only', name: 'Text only' },
    ]
  },
  async listModels(provider) {
    if (provider === 'magpie') {
      return [
        { id: 'workbuddy/deepseek-v4.1-flash', name: 'DeepSeek-V4.1-Flash', inputModalities: ['text', 'image'], contextWindow: 1000000 },
      ]
    }
    return [{ id: 'plain', name: 'Plain', inputModalities: ['text'] }]
  },
  async resolveModelInfo(provider, model) {
    return { provider, model, inputModalities: model === 'plain' ? ['text'] : ['text', 'image'] }
  },
  async *stream(options) {
    assert.ok(options.sessionId, 'every plugin LLM call carries a session id for OpenCode routing')
    const content = Array.isArray(options.messages[0].content) ? options.messages[0].content : []
    const textBlock = content.filter((block) => block && block.type === 'text')[0]
    const prompt = textBlock ? textBlock.text : ''
    if (/【选中的知识点】/.test(prompt)) lastBoardChat = { prompt, content, system: options.system }
    let answer
    if (/严格输出一个 JSON|knowledgePoints/.test(prompt)) {
      answer = JSON.stringify({
        title: '第一章：极限与连续',
        overview: '本课从数列极限过渡到函数极限，并给出连续性的判断方法。',
        knowledgePoints: [
          { name: '函数极限的 ε-δ 定义', detail: '对任意 ε>0，存在 δ>0，当 0<|x-x0|<δ 时 |f(x)-A|<ε。', importance: 'high', page: 1 },
          { name: '连续的三个条件', detail: '左极限、右极限存在且相等，并且等于函数值。', importance: 'medium', page: 2 },
        ],
        examPoints: [{ name: '用定义证明极限', why: '期末常见证明题', how: '先放缩，再取 δ=min(…)' }],
        pitfalls: ['δ 的取值必须依赖 ε'],
        studyPlan: [{ title: '第 1 步：背定义', steps: ['默写 ε-δ 定义', '做两道证明题'] }],
      })
    } else if (/逐页笔记/.test(prompt)) {
      answer = '第 1 页：极限的 ε-δ 定义。\n第 2 页：连续的三个条件。'
    } else {
      answer = 'AI 回答：这一页的关键是 ε-δ 定义，δ 需要依赖 ε 选取。'
    }
    yield { type: 'text-delta', text: answer }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
}

let credentialRecord = {
  kind: 'grant',
  payload: { cookie: 'sessionid=abcdefgh12345678; csrftoken=csrf1; university_id=42' },
}

const ctx = {
  fiber: { entry: { options: { id: 'study-coach' } } },
  effect(fn) { const dispose = fn(); return typeof dispose === 'function' ? dispose : () => {} },
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
        async readRecord() {
          return credentialRecord
        },
        async modifyRecord(_key, mutate) {
          credentialRecord = await mutate(credentialRecord)
          return credentialRecord
        },
        async deleteRecord() { credentialRecord = undefined },
      }
    }
    if (name === 'attachments') {
      return {
        imageLimits: { maxImageBytes: 5_000_000, maxImagesPerMessage: 12 },
        async saveImage(input) {
          // Mirror dsh-attachment-local: the declared type must match the bytes.
          const b = input.data
          const actual = b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : 'unknown'
          if (actual !== input.mediaType) {
            const error = new Error('Declared image type does not match its bytes.')
            error.code = 'IMAGE_TYPE_MISMATCH'
            throw error
          }
          imageCounter += 1
          const ref = {
            attachmentId: 'img-' + imageCounter,
            mediaType: input.mediaType,
            bytes: input.data.byteLength,
            width: 800,
            height: 600,
            name: input.name,
          }
          savedImages.push(ref)
          return ref
        },
      }
    }
    if (name === 'llm') return llm
    if (name === 'agentDefaultModel') {
      return { currentSelection: () => ({ provider: 'magpie', model: 'workbuddy/deepseek-v4.1-flash', reasoningEffort: 'max' }) }
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

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json', getSetCookie: () => [] },
    text: async () => JSON.stringify(payload),
  }
}

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
globalThis.fetch = async (url) => {
  const parsed = new URL(String(url))
  if (parsed.pathname === '/api/v3/user/basic-info') {
    return jsonResponse({ code: 0, data: { user_id: 'u1', name: '测试账号', school: '测试大学' } })
  }
  if (parsed.pathname === '/v2/api/web/userinfo') {
    return jsonResponse({ code: 0, data: [{ university_id: 42 }] })
  }
  if (parsed.pathname === '/api/v3/classroom-report/student/lesson-info') {
    return jsonResponse({ code: 0, data: { lessonId: 'L1', lessonName: '第一章 极限与连续', courseName: '高等数学', classroomName: '一班', teacherName: '张老师', presentationIds: ['P1'] } })
  }
  if (parsed.pathname === '/api/v3/lesson-summary/student') {
    return jsonResponse({ code: 0, data: { presentations: [{ id: 'P1', title: '第一章课件 A', slidesCount: 2 }, { id: 'P2', title: '第一章课件 B', slidesCount: 2 }], lesson: { title: '第一章' }, checkIn: null } })
  }
  if (parsed.pathname === '/api/v3/lesson-summary/student/presentation') {
    const presentationId = parsed.searchParams.get('presentation_id')
    const slides = presentationId === 'P2'
      ? [{ id: 's3', index: 3, cover: 'slides/3.png' }, { id: 's4', index: 4, cover: 'slides/4.png' }]
      : [{ id: 's1', index: 1, cover: 'slides/1.png' }, { id: 's2', index: 2, cover: 'slides/2.png' }]
    return jsonResponse({ code: 0, data: { slides } })
  }
  if (parsed.pathname === '/api/v3/lesson-summary/replay') {
    return jsonResponse({ code: 0, data: { lessonDuration: 600000, timeLine: [] } })
  }
  if (parsed.pathname === '/api/v3/lesson-summary/query-lesson-mind-map') {
    return jsonResponse({ code: 0, data: { overallMindMap: { name: '极限' } } })
  }
  if (parsed.pathname === '/api/v3/lesson-summary/query-lecture-note') {
    return jsonResponse({ code: 0, data: { list: [], taskStatus: 2 } })
  }
  if (parsed.hostname === 'qn-scd1.yuketang.cn') {
    return {
      ok: true,
      status: 200,
      // Yuketang's CDN often mislabels PNG slides; the plugin must sniff bytes.
      headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'image/jpeg' : null), getSetCookie: () => [] },
      arrayBuffer: async () => pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength),
    }
  }
  throw new Error('unexpected URL ' + url)
}

apply(ctx, config)
assert.equal(routes.size, 19)

function request(url, method = 'GET', body = '') {
  const chunks = body ? [Buffer.from(body)] : []
  return { url, method, headers: {}, socket: { remoteAddress: '127.0.0.1' }, async *[Symbol.asyncIterator]() { yield* chunks } }
}
function response() {
  return { status: 0, body: '', writeHead(status) { this.status = status }, end(text) { this.body = text } }
}
const trusted = {
  'x-dsh-ykt-bridge': '1',
  host: '127.0.0.1:53957',
  origin: 'http://127.0.0.1:53957',
  'sec-fetch-site': 'same-origin',
}
async function call(pathWithQuery, method = 'GET', body = '') {
  const pathname = pathWithQuery.split('?')[0]
  const route = routes.get('/api/local/dsh-ykt-study/' + pathname)
  assert.ok(route, 'route exists: ' + pathname)
  const res = response()
  const req = request('/api/local/dsh-ykt-study/' + pathWithQuery, method, body)
  req.headers = trusted
  await route.handler(req, res)
  return { status: res.status, body: res.body ? JSON.parse(res.body) : null }
}

const models = await call('models')
assert.equal(models.body.ok, true)
assert.equal(models.body.data.providers[0].id, 'magpie')
assert.equal(models.body.data.effective.provider, 'magpie')
assert.equal(models.body.data.providers[0].models[0].vision, true)

const savedModel = await call('model', 'POST', JSON.stringify({ provider: 'magpie', model: 'workbuddy/deepseek-v4.1-flash' }))
assert.equal(savedModel.body.ok, true)
assert.equal(config.aiProvider, 'magpie')
assert.equal(config.aiModel, 'workbuddy/deepseek-v4.1-flash')

const started = await call('summary/start', 'POST', JSON.stringify({ lessonId: 'L1', force: true }))
assert.equal(started.body.ok, true)
assert.ok(['queued', 'running', 'done'].includes(started.body.data.job.status))

let job = null
for (let attempt = 0; attempt < 200; attempt += 1) {
  const status = await call('summary/status?lessonId=L1')
  job = status.body.data.job
  if (job && job.status !== 'queued' && job.status !== 'running') break
  await new Promise((resolve) => setTimeout(resolve, 20))
}
assert.ok(job, 'summary job returned')
assert.equal(job.status, 'done', 'summary completes: ' + JSON.stringify(job && job.error))
assert.equal(job.result.knowledgePoints.length, 2)
assert.equal(job.result.examPoints.length, 1)
assert.ok(job.totalSlides >= 2)
assert.ok(savedImages.length >= 2, 'slide images saved as attachments')

const cards = await call('summary/cards', 'POST', JSON.stringify({ lessonId: 'L1' }))
assert.equal(cards.body.ok, true)
assert.ok(cards.body.data.added >= 2)
const stateAfterCards = JSON.parse(config.stateJson)
assert.ok(stateAfterCards.cards.some((card) => card.deck.indexOf('雨课堂') === 0))

const cached = await call('summary/start', 'POST', JSON.stringify({ lessonId: 'L1' }))
assert.equal(cached.body.data.job.cached, true)
assert.equal(cached.body.data.job.status, 'done')

const chat = await call('page-chat', 'POST', JSON.stringify({
  lessonId: 'L1',
  presentationId: 'P1',
  slideIndex: 1,
  question: '这里的 δ 怎么取？',
  annotations: [{ tool: 'highlight', points: [[0.1, 0.4], [0.7, 0.4]] }],
}))
assert.equal(chat.body.ok, true)
assert.match(chat.body.data.answer, /ε-δ/)
assert.equal(chat.body.data.page.index, 1)

// Right-click a knowledge-board node and ask about it.
const boardChat = await call('board-chat', 'POST', JSON.stringify({
  lessonId: 'L1',
  presentationId: 'P1',
  courseName: '高等数学',
  lessonTitle: '第一章',
  treeTitle: '函数极限',
  node: { id: 'n2', label: '单侧极限', detail: '左右极限', pages: [2, 99], importance: 'high' },
  path: ['ε-δ 定义'],
  children: ['左极限', '右极限'],
  siblings: ['极限的性质'],
  question: '举一个具体例子',
  history: [{ role: 'user', text: '先解释一下' }, { role: 'assistant', text: '好的' }],
}))
assert.equal(boardChat.body.ok, true, JSON.stringify(boardChat.body.error))
assert.match(boardChat.body.data.answer, /AI 回答/)
assert.deepEqual(boardChat.body.data.pages, [2], 'only pages that exist in the presentation are attached')
assert.match(lastBoardChat.prompt, /从树根到它：ε-δ 定义 → 单侧极限/)
assert.match(lastBoardChat.prompt, /它的下级知识点：左极限、右极限/)
assert.match(lastBoardChat.prompt, /同级知识点：极限的性质/)
assert.match(lastBoardChat.prompt, /学生：先解释一下/)
assert.match(lastBoardChat.prompt, /【当前问题】\n举一个具体例子/)
assert.equal(lastBoardChat.content.filter((block) => block.type === 'image').length, 1)
assert.match(lastBoardChat.system, /知识看板/)
const boardChatBad = await call('board-chat', 'POST', JSON.stringify({ node: { label: '' }, question: 'x' }))
assert.equal(boardChatBad.body.ok, false)

// Account scoping: logging out must drop the old account's cached summary.
const logout = await call('logout', 'POST', JSON.stringify({}))
assert.equal(logout.body.ok, true)
const statusAfterLogout = await call('summary/status?lessonId=L1')
assert.equal(statusAfterLogout.body.ok, false)
assert.match(statusAfterLogout.body.error.message, /登录/)
const relogin = await call('login', 'POST', JSON.stringify({ sessionid: 'abcdefgh12345678', region: 'standard' }))
assert.equal(relogin.body.ok, true)
const statusAfterRelogin = await call('summary/status?lessonId=L1')
assert.equal(statusAfterRelogin.body.ok, true)
assert.equal(statusAfterRelogin.body.data.job, null, 'old account summary is not visible')
assert.equal(config.yktUserId, 'u1')

console.log('host-ai.test.mjs — all AI integration assertions passed')
