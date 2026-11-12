/**
 * Host-side AI integration: model catalog, model override, whole-lesson summary
 * job (all slides -> partial notes -> structured summary), summary cards and
 * per-slide chat. Uses fake `llm` + fake Yuketang HTTP responses.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
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
// A content-addressed store on disk, shaped like dsh-attachment-local: no
// delete API, but imageHostPath() exposes where each object lives.
const attachmentRoot = path.join(dataDir, 'dsh-home', 'attachments', 'v1')
const attachmentCacheRoot = path.join(dataDir, 'dsh-home', 'cache', 'attachments')
const attachmentStore = {
  root: attachmentRoot,
  cacheRoot: attachmentCacheRoot,
  imageLimits: { maxImageBytes: 5_000_000, maxImagesPerMessage: 12 },
  imageHostPath(ref) {
    return path.join(attachmentRoot, 'objects', ref.sha256.slice(0, 2), ref.sha256)
  },
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
    const sha256 = crypto.createHash('sha256').update(Buffer.from(b)).digest('hex')
    const ref = {
      attachmentId: 'img-' + imageCounter,
      sha256,
      mediaType: input.mediaType,
      bytes: input.data.byteLength,
      width: 800,
      height: 600,
      name: input.name,
    }
    const file = attachmentStore.imageHostPath(ref)
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, Buffer.from(b))
      fs.chmodSync(file, 0o444)
    }
    savedImages.push(ref)
    return ref
  },
}
const storedObjects = () => {
  const dir = path.join(attachmentRoot, 'objects')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).flatMap((shard) => fs.readdirSync(path.join(dir, shard)))
}
const requestCacheFiles = () => {
  const dir = path.join(attachmentCacheRoot, 'request-images')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).flatMap((shard) => fs.readdirSync(path.join(dir, shard)))
}
const sessionIds = new Set()
const savedImages = []
let lastBoardChat = null
let lastPageChat = null

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
    sessionIds.add(options.sessionId)
    // The host caches a provider-sized copy of every attached image.
    for (const block of Array.isArray(options.messages[0].content) ? options.messages[0].content : []) {
      if (block && block.type === 'image' && block.attachment && block.attachment.sha256) {
        const variant = crypto.createHash('sha256').update(block.attachment.sha256 + ':request').digest('hex')
        const file = path.join(attachmentCacheRoot, 'request-images', variant.slice(0, 2), variant)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, 'variant')
      }
    }
    const content = Array.isArray(options.messages[0].content) ? options.messages[0].content : []
    const textBlock = content.filter((block) => block && block.type === 'text')[0]
    const prompt = textBlock ? textBlock.text : ''
    if (/【选中的知识点】/.test(prompt)) lastBoardChat = { prompt, content, system: options.system }
    if (/【当前课件】/.test(prompt)) lastPageChat = { prompt, content, system: options.system }
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
    if (name === 'attachments') return attachmentStore
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
assert.equal(routes.size, 23)

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
assert.deepEqual(storedObjects(), [], 'summary slide images are deleted once read')
assert.deepEqual(requestCacheFiles(), [], 'request-sized copies are deleted too')

const cards = await call('summary/cards', 'POST', JSON.stringify({ lessonId: 'L1' }))
assert.equal(cards.body.ok, true)
assert.ok(cards.body.data.added >= 2)
const stateAfterCards = JSON.parse(config.stateJson)
assert.ok(stateAfterCards.cards.some((card) => card.deck.indexOf('雨课堂') === 0))

const cached = await call('summary/start', 'POST', JSON.stringify({ lessonId: 'L1' }))
assert.equal(cached.body.data.job.cached, true)
assert.equal(cached.body.data.job.status, 'done')

// Unticked slides never reach the model: keep only P1 page 1.
const imagesBeforePicked = savedImages.length
const picked = await call('summary/start', 'POST', JSON.stringify({ lessonId: 'L1', force: true, exclude: { P1: [2], P2: [3, 4] } }))
assert.equal(picked.body.ok, true, JSON.stringify(picked.body.error))
let pickedJob = null
for (let attempt = 0; attempt < 200; attempt += 1) {
  const status = await call('summary/status?lessonId=L1')
  pickedJob = status.body.data.job
  if (pickedJob && pickedJob.status !== 'queued' && pickedJob.status !== 'running') break
  await new Promise((resolve) => setTimeout(resolve, 20))
}
assert.equal(pickedJob.status, 'done', 'partial summary completes: ' + JSON.stringify(pickedJob && pickedJob.error))
assert.equal(pickedJob.totalSlides, 1, 'only the ticked slide is summarized')
assert.equal(pickedJob.excludedSlides, 3)
assert.equal(pickedJob.result.meta.excludedSlideCount, 3)
assert.equal(pickedJob.result.meta.truncated, false, 'unticked pages are not reported as truncation')
assert.ok(savedImages.slice(imagesBeforePicked).every((ref) => !/ykt-slide-P2-|ykt-slide-P1-2$/.test(ref.name)), 'unticked slide images are not attached')

const nonePicked = await call('summary/start', 'POST', JSON.stringify({ lessonId: 'L1', force: true, exclude: { P1: [1, 2], P2: [3, 4] } }))
assert.equal(nonePicked.body.ok, true)
let noneJob = null
for (let attempt = 0; attempt < 200; attempt += 1) {
  const status = await call('summary/status?lessonId=L1')
  noneJob = status.body.data.job
  if (noneJob && noneJob.status !== 'queued' && noneJob.status !== 'running') break
  await new Promise((resolve) => setTimeout(resolve, 20))
}
assert.equal(noneJob.status, 'error')
assert.match(noneJob.error, /至少勾选一页/)

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

// Circled region: the close-up crop must come first and the prompt must pin the
// answer to the marked spot instead of the whole slide.
const tinyJpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64')
const markedJpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 2]).toString('base64')
// The same bytes already sit in the store from one of the user's own chats.
await new Promise((resolve) => setTimeout(resolve, 1700))
const userOwned = await attachmentStore.saveImage({ data: new Uint8Array(Buffer.from(tinyJpeg.split(',')[1], 'base64')), mediaType: 'image/jpeg', name: 'user-chat' })
fs.utimesSync(attachmentStore.imageHostPath(userOwned), new Date(Date.now() - 60_000), new Date(Date.now() - 60_000))
await new Promise((resolve) => setTimeout(resolve, 1700))
const focusChat = await call('page-chat', 'POST', JSON.stringify({
  lessonId: 'L1',
  presentationId: 'P1',
  slideIndex: 1,
  question: '这个是什么意思？',
  annotations: [{ tool: 'pen', points: [[0.2, 0.3], [0.4, 0.5]] }],
  focus: [{ image: tinyJpeg, box: { x0: 0.14, y0: 0.25, x1: 0.46, y1: 0.55 } }],
  marked: markedJpeg,
}))
assert.equal(focusChat.body.ok, true, JSON.stringify(focusChat.body.error))
assert.deepEqual(storedObjects(), [userOwned.sha256], 'plugin images deleted; an identical image the user already had is kept')
assert.deepEqual(requestCacheFiles(), [])
const pageImages = lastPageChat.content.filter((block) => block.type === 'image')
assert.equal(pageImages.length, 2, 'focus crop + marked page')
assert.match(pageImages[0].attachment.name, /^ykt-focus-/, 'focus crop is the first image')
assert.match(pageImages[1].attachment.name, /^ykt-marked-/, 'marked page replaces the plain slide')
assert.match(lastPageChat.prompt, /前 1 张图是标注区域的放大裁剪图/)
assert.match(lastPageChat.prompt, /不要概述整页/)
assert.match(lastPageChat.system, /指代都指标注处/)
const captions = lastPageChat.content.filter((block) => block.type === 'text').map((block) => block.text)
assert.ok(captions.some((value) => /图片 1：学生标注区域放大图（位于整页横向 14%–46%，纵向 25%–55%）/.test(value)))

assert.ok([...sessionIds].every((id) => /^dsh-study-coach-[0-9a-f-]{36}$/.test(id)), 'plugin calls use a plugin-only session id: ' + [...sessionIds].join(','))
assert.equal(sessionIds.size, 1)

// Saved chats: text only, bounded, clearable.
const chatFile = path.join(dataDir, 'chats.json')
const savedPage = await call('chats/save', 'POST', JSON.stringify({ lessonId: 'L1', kind: 'page', key: 'P1:1', messages: [{ role: 'user', text: '问' }, { role: 'assistant', text: '答' }, { role: 'system', text: 'x' }] }))
assert.equal(savedPage.body.ok, true, JSON.stringify(savedPage.body.error))
await call('chats/save', 'POST', JSON.stringify({ lessonId: 'L1', kind: 'board', key: 'n2', messages: Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: 'm' + i })) }))
const loadedChats = await call('chats/load', 'POST', JSON.stringify({ lessonId: 'L1' }))
assert.deepEqual(loadedChats.body.data.page['P1:1'], [{ role: 'user', text: '问' }, { role: 'assistant', text: '答' }])
assert.equal(loadedChats.body.data.board.n2.length, 30, 'threads keep the last 30 messages')
assert.equal(loadedChats.body.data.board.n2[29].text, 'm49')
assert.ok(fs.existsSync(chatFile))
assert.doesNotMatch(fs.readFileSync(chatFile, 'utf8'), /base64|data:image/, 'no images are saved with chats')
await call('chats/save', 'POST', JSON.stringify({ lessonId: 'L1', kind: 'page', key: 'P1:1', messages: [] }))
assert.equal((await call('chats/load', 'POST', JSON.stringify({ lessonId: 'L1' }))).body.data.page['P1:1'], undefined, 'empty thread is removed')
await call('chats/clear', 'POST', JSON.stringify({ lessonId: 'L1' }))
assert.equal(fs.existsSync(chatFile), false, 'clearing the last lesson removes the file')

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
