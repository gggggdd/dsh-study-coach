/**
 * 学习教练（Learning Coach）— Host half.
 *
 * Responsibilities:
 *  - Own the learner's spaced-repetition deck (cards, review log, streak).
 *  - Register the model-facing `study` tool and the `/study` human command.
 *  - Contribute a compact "study coach" system-prompt section plus a per-request
 *    progress context so the assistant knows when a review is waiting.
 *
 * Persistence: the deck is stored as one JSON snapshot in this plugin row's
 * volatile `stateJson` Config field. The Web client reads the same snapshot
 * through `remote.settings.describe()` and writes grades back through
 * `remote.settings.update()`, so the panel and the agent always share one
 * durable copy in the profile.
 */

import { createRequire } from 'node:module'
import { chmod, mkdir, readFile, readdir, rename, rmdir, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import * as ykt from './ykt.js'
import * as ai from './ai.js'

const PLUGIN_NAME = 'study-coach'
const DAY_MS = 86_400_000
const MAX_CARDS = 500
const MAX_FRONT = 4_000
const MAX_BACK = 8_000

// Whole-lesson AI summary limits. A lesson usually has 20–120 slides; six
// images per model call keeps each request small while covering every page.
const MAX_SUMMARY_SLIDES = 240
const SLIDES_PER_BATCH = 6
const MAX_SUMMARY_CACHE = 60
// Saved slide/board chats are text only and bounded so the file stays small.
const MAX_CHAT_LESSONS = 30
const MAX_CHAT_THREADS_PER_LESSON = 60
const MAX_CHAT_MESSAGES_PER_THREAD = 30
const MAX_CHAT_MESSAGE_CHARS = 6_000
// Batches read in parallel; lowered automatically when the provider throttles.
const SUMMARY_READ_CONCURRENCY = 3
// Simultaneous slide downloads (current batches + the prefetched next ones).
const SLIDE_FETCH_CONCURRENCY = 8
const RATE_LIMIT_RETRIES = 3
const RATE_LIMIT_BACKOFF_MS = 2_000

/** Run at most `limit` async tasks at once. */
function createLimiter(limit) {
  let active = 0
  const queue = []
  const pump = () => {
    while (active < limit && queue.length) {
      const { task, resolve, reject } = queue.shift()
      active += 1
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          active -= 1
          pump()
        })
    }
  }
  return (task) => new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject })
    pump()
  })
}

/** Abortable delay. */
function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal && signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', done)
      resolve()
    }
    if (signal) signal.addEventListener('abort', done, { once: true })
  })
}

// ---------------------------------------------------------------------------
// Schema factory: @deepseek-ai/schemastery is a Host package outside npm, so
// resolve it defensively (same two-stage recipe used by other desktop plugins).
// When it truly cannot be resolved, a tiny shim keeps the module loadable; the
// real Config schema is what the settings service reads, so a missing library
// only affects the settings form, never activation.
// ---------------------------------------------------------------------------
async function resolveSchemaFactory() {
  try {
    const anchor = typeof process.argv[1] === 'string' && process.argv[1] !== '' ? process.argv[1] : process.execPath
    const factory = createRequire(anchor)('@deepseek-ai/schemastery')
    if (factory != null && typeof factory.object === 'function') return factory
  } catch {
    /* fall through */
  }
  try {
    const selfRequire = createRequire(new URL(import.meta.url))
    const factory = selfRequire('@deepseek-ai/schemastery')
    if (factory != null && typeof factory.object === 'function') return factory
  } catch {
    /* fall through */
  }
  try {
    const resolved = await import('@deepseek-ai/schemastery')
    const factory = (resolved && (resolved.default || resolved.Schema)) || null
    return factory != null && typeof factory.object === 'function' ? factory : null
  } catch {
    return null
  }
}

function makeSchemaShim() {
  const node = () => {
    const self = {
      default: () => self,
      volatile: () => self,
      role: () => self,
      description: () => self,
      hidden: () => self,
      min: () => self,
      max: () => self,
      optional: () => self,
      required: () => self,
      deprecated: () => self,
    }
    return self
  }
  return {
    object: node,
    string: node,
    number: node,
    boolean: node,
    array: node,
    dict: node,
    any: node,
    union: node,
    const: node,
    enum: node,
  }
}

const zReal = await resolveSchemaFactory()
const z = zReal || makeSchemaShim()

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function dayKey(date = new Date()) {
  const pad = (n) => (n < 10 ? '0' + n : String(n))
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function seededState() {
  const now = Date.now()
  const cards = [
    {
      id: 'seed-spaced',
      front: '什么是间隔重复（Spaced Repetition）？',
      back: '一种根据遗忘曲线安排复习时间的方法：每次成功回忆后延长下次复习间隔，让复习发生在“快要忘记”之前。',
      deck: '学习方法',
      tags: ['记忆', '方法'],
    },
    {
      id: 'seed-recall',
      front: '主动回忆（Active Recall）为什么比反复阅读更有效？',
      back: '因为“把记忆提取出来”的过程会强化检索路径；反复阅读只带来熟悉感，并不等于真的能回忆出来。',
      deck: '学习方法',
      tags: ['记忆', '方法'],
    },
    {
      id: 'seed-card',
      front: '一张好的学习卡片应该长什么样？',
      back: '只问一个点、问题明确、答案简短；能独立判断对错，避免把多个事实塞进同一张卡。',
      deck: '学习方法',
      tags: ['卡片'],
    },
  ].map((card) => ({
    ...card,
    createdAt: now,
    due: now,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    lastReview: null,
  }))
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    cards,
    daily: {},
    streak: { lastDay: '', days: 0 },
  }
}

const SEED_STATE_JSON = JSON.stringify(seededState())

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampText(value, max) {
  const text = String(value == null ? '' : value).trim()
  return text.length > max ? text.slice(0, max) : text
}

function normalizeGrade(value) {
  const grade = String(value || '').trim().toLowerCase()
  if (grade === 'again' || grade === 'hard' || grade === 'good' || grade === 'easy') return grade
  if (grade === '忘记' || grade === '忘了' || grade === '1') return 'again'
  if (grade === '困难' || grade === '模糊' || grade === '2') return 'hard'
  if (grade === '良好' || grade === '记住' || grade === '3') return 'good'
  if (grade === '简单' || grade === '太简单' || grade === '4') return 'easy'
  return ''
}

function normalizeState(raw) {
  if (!isRecord(raw)) return seededState()
  const cards = Array.isArray(raw.cards)
    ? raw.cards
        .filter((card) => isRecord(card) && clampText(card.front, 1) && clampText(card.back, 1))
        .slice(0, MAX_CARDS)
        .map((card) => ({
          id: String(card.id || ''),
          front: clampText(card.front, MAX_FRONT),
          back: clampText(card.back, MAX_BACK),
          deck: clampText(card.deck, 60) || '默认',
          tags: Array.isArray(card.tags)
            ? card.tags.map((tag) => clampText(tag, 40)).filter(Boolean).slice(0, 8)
            : [],
          createdAt: Number(card.createdAt) || Date.now(),
          due: Number(card.due) || Date.now(),
          interval: Number(card.interval) || 0,
          ease: Math.min(3.2, Math.max(1.3, Number(card.ease) || 2.5)),
          reps: Math.max(0, Number(card.reps) || 0),
          lapses: Math.max(0, Number(card.lapses) || 0),
          lastReview: Number(card.lastReview) || null,
        }))
        .filter((card) => card.id !== '')
    : []

  const daily = {}
  if (isRecord(raw.daily)) {
    for (const [key, value] of Object.entries(raw.daily)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !isRecord(value)) continue
      daily[key] = {
        reviews: Math.max(0, Number(value.reviews) || 0),
        again: Math.max(0, Number(value.again) || 0),
        hard: Math.max(0, Number(value.hard) || 0),
        good: Math.max(0, Number(value.good) || 0),
        easy: Math.max(0, Number(value.easy) || 0),
      }
    }
  }
  const recentDays = Object.keys(daily).sort()
  for (const key of recentDays.slice(0, Math.max(0, recentDays.length - 120))) delete daily[key]

  return {
    version: 1,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || 0,
    cards,
    daily,
    streak: {
      lastDay: isRecord(raw.streak) && typeof raw.streak.lastDay === 'string' ? raw.streak.lastDay : '',
      days: isRecord(raw.streak) ? Math.max(0, Number(raw.streak.days) || 0) : 0,
    },
  }
}

/** Schedule one card. Pure; mirrored verbatim in client.js. */
function gradeCard(card, grade, now) {
  let ease = Number(card.ease) || 2.5
  let interval = Number(card.interval) || 0
  let reps = Number(card.reps) || 0
  let lapses = Number(card.lapses) || 0
  let nextDays

  if (grade === 'again') {
    ease = Math.max(1.3, ease - 0.2)
    interval = 0
    reps = 0
    lapses += 1
    nextDays = 10 / 1440
  } else if (grade === 'hard') {
    ease = Math.max(1.3, ease - 0.15)
    reps += 1
    nextDays = interval <= 0 ? 1 : Math.max(1, interval * 1.2)
  } else if (grade === 'good') {
    nextDays = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(1, interval * ease)
    reps += 1
  } else {
    ease = Math.min(3.2, ease + 0.15)
    nextDays = reps === 0 ? 2 : reps === 1 ? 5 : Math.max(1, interval * ease * 1.3)
    reps += 1
  }

  return {
    ...card,
    ease: Math.round(ease * 100) / 100,
    interval: Math.round(nextDays * 10) / 10,
    reps,
    lapses,
    due: now + nextDays * DAY_MS,
    lastReview: now,
  }
}

function applyReview(state, cardId, grade, now) {
  const card = state.cards.find((item) => item.id === cardId)
  if (!card) return { error: 'card-not-found' }
  const graded = gradeCard(card, grade, now)
  const today = dayKey(new Date(now))
  const daily = { ...state.daily }
  const row = { reviews: 0, again: 0, hard: 0, good: 0, easy: 0, ...(daily[today] || {}) }
  row.reviews += 1
  row[grade] = (row[grade] || 0) + 1
  daily[today] = row

  let streak = { ...state.streak }
  if (streak.lastDay !== today) {
    const yesterday = dayKey(new Date(now - DAY_MS))
    streak = {
      lastDay: today,
      days: streak.lastDay === yesterday ? (streak.days || 0) + 1 : 1,
    }
  }

  return {
    state: {
      ...state,
      cards: state.cards.map((item) => (item.id === cardId ? graded : item)),
      daily,
      streak,
      updatedAt: now,
    },
    card: graded,
  }
}

function computeStats(state, dailyGoal) {
  const now = Date.now()
  const today = dayKey(new Date(now))
  const todayRow = state.daily[today] || { reviews: 0 }
  const due = state.cards.filter((card) => card.due <= now).length
  const mastered = state.cards.filter((card) => card.interval >= 21).length
  const learning = state.cards.filter((card) => card.interval > 0 && card.interval < 21).length
  const fresh = state.cards.filter((card) => card.interval === 0).length
  return {
    total: state.cards.length,
    due,
    reviewedToday: Number(todayRow.reviews) || 0,
    dailyGoal: Number(dailyGoal) || 15,
    streak: Number(state.streak && state.streak.days) || 0,
    mastered,
    learning,
    fresh,
  }
}

function formatDueLabel(ts) {
  const delta = Number(ts) - Date.now()
  if (!Number.isFinite(delta) || delta <= 0) return '现在'
  const minutes = Math.round(delta / 60000)
  if (minutes < 60) return `${minutes} 分钟后`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时后`
  return `${Math.round(delta / DAY_MS)} 天后`
}

function newCardId() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const Config = z.object({
  /** Whole deck snapshot (JSON). Volatile so both the panel and the tool can write it live. */
  stateJson: z.string().default(SEED_STATE_JSON).volatile(),
  /** Daily review goal used by the panel's progress ring. */
  dailyGoal: z.number().default(15).volatile(),
  /** Yuketang region: standard | hetang | changjiang | huanghe. */
  yktRegion: z.string().default('standard').volatile(),
  /** Cached account name shown in the panel. */
  yktAccount: z.string().default('').volatile(),
  /** Cached school name. */
  yktSchool: z.string().default('').volatile(),
  /** Cached Yuketang user id (used to scope local AI summaries per account). */
  yktUserId: z.string().default('').volatile(),
  /** AI model chosen by the user for summaries and slide chat. Empty = follow the harness default. */
  aiProvider: z.string().default('').volatile(),
  aiModel: z.string().default('').volatile(),
  aiReasoning: z.string().default('').volatile(),
})

function vget(ref, fallback) {
  if (ref && typeof ref.get === 'function') {
    const value = ref.get()
    return value === undefined ? fallback : value
  }
  return ref === undefined || ref === null ? fallback : ref
}

// ---------------------------------------------------------------------------
// Prompt copy
// ---------------------------------------------------------------------------

const STUDY_SECTION = `# Study deck and Yuketang

The \`study\` tool owns the learner's spaced-repetition deck shown in the 学习中心 / Learning Coach panel. When the user learns something worth keeping, turn the explanation into a small number of focused flashcards — one card per coherent concept or tightly related Q&A cluster, not one card per sentence or per answer. If a new point extends an existing card in the same deck, merge it into that card (or update it) instead of adding a near-duplicate. When they ask to review or be tested, fetch the due queue, ask one question at a time, reveal the answer, explain any gap, and record the grade. Teach for retention rather than coverage, never grade without an answer, and never invent progress numbers.

The \`ykt\` tool reads the user's own 雨课堂 (Yuketang) courses and courseware. When the user mentions 雨课堂、课程、课件、学习计划 or 考点, use it: \`status\` → \`courses\` → \`activities\` → \`lesson\` → \`slides\` (with \`attach: true\` to read slides as images) → \`progress\` / \`mind_map\`. The 雨课堂 tab in the panel handles login with a sessionid; never ask the user to paste it into chat and never print it. This tool is read-only: never check in, answer questions, or submit anything. After reading courseware, produce a dated study plan and a prioritized 考点清单, then turn the key points into a small set of focused \`study\` cards (combine related points into the same card rather than one card per point).

The 雨课堂 panel also has its own one-click "AI 总结" that reads every slide of a lesson with the user's selected model, and a fullscreen slide viewer with per-page AI chat and pen/highlighter annotations. Those actions run locally through the plugin; do not duplicate a summary that already exists in the panel unless the user asks for a fresh analysis.`

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const name = PLUGIN_NAME
export const inject = ['tools', 'commands', 'systemPrompt', 'settings']

export function apply(ctx, config) {
  const settings = ctx.settings
  const ownEntryId = (() => {
    try {
      const id = ctx.fiber && ctx.fiber.entry && ctx.fiber.entry.options && ctx.fiber.entry.options.id
      if (typeof id === 'string' && id) return id.startsWith('include:') ? id.slice('include:'.length) : id
    } catch {
      /* fall through */
    }
    return PLUGIN_NAME
  })()

  let state
  try {
    const initialRaw = vget(config.stateJson, SEED_STATE_JSON) || SEED_STATE_JSON
    state = normalizeState(JSON.parse(initialRaw))
  } catch {
    state = seededState()
  }
  let lastRaw = vget(config.stateJson, '')
  let queue = Promise.resolve()

  function dailyGoal() {
    return Math.max(1, Number(vget(config.dailyGoal, 15)) || 15)
  }

  function syncFromConfig() {
    const raw = vget(config.stateJson, '')
    if (typeof raw === 'string' && raw !== lastRaw) {
      try {
        state = normalizeState(JSON.parse(raw))
        lastRaw = raw
      } catch {
        /* keep the current in-memory state when the row holds malformed text */
      }
    }
    return state
  }

  function serial(fn) {
    const next = queue.then(fn, fn)
    queue = next.catch(() => {})
    return next
  }

  async function persist(next) {
    const snapshot = { ...next, updatedAt: Date.now() }
    const json = JSON.stringify(snapshot)
    try {
      await settings.update(ownEntryId, { stateJson: json })
    } catch (error) {
      throw new Error(`学习数据保存失败：${(error && error.message) || error}`)
    }
    state = snapshot
    lastRaw = json
  }

  // -------------------------------------------------------------------------
  // Yuketang (雨课堂) read-only integration
  // -------------------------------------------------------------------------
  function yktRegion() {
    const region = String(vget(config.yktRegion, 'standard') || 'standard')
    return ykt.isRegion(region) ? region : 'standard'
  }

  function yktScopeKey() {
    const userId = clampText(vget(config.yktUserId, ''), 80).replace(/\|\|/g, '_')
    const account = clampText(vget(config.yktAccount, ''), 80).replace(/\|\|/g, '_')
    return `${yktRegion()}||${userId || account || 'anonymous'}`
  }

  function scopedLessonKey(lessonId) {
    return `${yktScopeKey()}||${String(lessonId || '')}`
  }

  const qrTickets = new Map()

  async function readYktSession() {
    const credentials = ctx.get('credentials')
    if (!credentials || typeof credentials.readRecord !== 'function') return ''
    try {
      const record = await credentials.readRecord('study-coach/ykt-session')
      if (!record || record.kind !== 'grant' || !record.payload || typeof record.payload !== 'object') return ''
      if (typeof record.payload.cookie === 'string' && record.payload.cookie) return record.payload.cookie
      return typeof record.payload.sessionid === 'string' ? `sessionid=${record.payload.sessionid}` : ''
    } catch {
      return ''
    }
  }

  async function yktStatus() {
    const session = await readYktSession()
    return {
      loggedIn: session !== '',
      account: String(vget(config.yktAccount, '') || ''),
      school: String(vget(config.yktSchool, '') || ''),
      region: yktRegion(),
      regionName: ykt.REGION_NAMES[yktRegion()],
    }
  }

  async function yktClient() {
    const session = await readYktSession()
    if (!session) {
      throw new ykt.YktError('尚未登录雨课堂。请打开「学习中心 → 雨课堂」，扫码或粘贴完整 Cookie 登录（不要只贴 sessionid）。', {
        nextAction: 'login-in-panel',
      })
    }
    return new ykt.YktClient(yktRegion(), session)
  }

  async function saveYktLogin(credential, region, profile) {
    const credentials = ctx.get('credentials')
    if (!credentials || typeof credentials.modifyRecord !== 'function') {
      throw new ykt.YktError('当前宿主没有可用的凭据服务，无法保存雨课堂会话')
    }
    const cleanRegion = ykt.isRegion(region) ? region : 'standard'
    const oldScope = yktScopeKey()
    const parsed = ykt.normalizeCookie(credential)
    await credentials.modifyRecord('study-coach/ykt-session', async function () {
      return { kind: 'grant', payload: { cookie: parsed.cookie, sessionid: parsed.sessionid, region: cleanRegion, savedAt: Date.now() } }
    })
    await settings.update(ownEntryId, {
      yktRegion: cleanRegion,
      yktAccount: profile && profile.name ? profile.name : '',
      yktSchool: profile && profile.school ? profile.school : '',
      yktUserId: profile && profile.userId ? String(profile.userId) : '',
    })
    if (oldScope !== yktScopeKey()) {
      try { await clearSummaryScope(oldScope) } catch { /* best effort */ }
    }
  }

  async function clearYktLogin() {
    const oldScope = yktScopeKey()
    const credentials = ctx.get('credentials')
    if (credentials && typeof credentials.deleteRecord === 'function') {
      try { await credentials.deleteRecord('study-coach/ykt-session') } catch { /* noop */ }
    }
    await settings.update(ownEntryId, { yktAccount: '', yktSchool: '', yktUserId: '' })
    try {
      await clearSummaryScope(oldScope)
    } catch {
      /* cleanup is best effort */
    }
  }

  function yktErrorSummary(error) {
    const lines = [`雨课堂错误：${(error && error.message) || String(error)}`]
    if (error && error.code !== undefined) lines.push(`平台码：${error.code}`)
    if (error && error.nextAction) lines.push(`建议：${error.nextAction}`)
    if (error && error.status === 500) lines.push('提示：雨课堂 500 常见于区域选错或 Cookie 缺少 csrftoken / university_id；请在「学习中心 → 雨课堂」选对区域，并用完整 Cookie 重新登录。')
    return lines.join('\n')
  }

  async function downloadSlideImages(slides, maxSlides) {
    const attachments = ctx.get('attachments')
    if (!attachments || typeof attachments.saveImage !== 'function') {
      return { images: [], note: '当前宿主没有图片附件服务，以下只返回图片链接。' }
    }
    const limits = attachments.imageLimits || {}
    const cap = Math.max(1, Math.min(maxSlides || 8, 12, Number(limits.maxImagesPerMessage) || 12))
    const images = []
    const skipped = []
    for (const slide of slides.slice(0, cap)) {
      const url = ykt.slideImageUrl(slide.cover)
      if (!url || !ykt.isAllowedSlideUrl(url)) {
        skipped.push(`第 ${slide.index} 页（图片地址不在雨课堂域名下）`)
        continue
      }
      try {
        const response = await fetchImageWithTimeout(url, undefined)
        if (!response.ok) {
          skipped.push(`第 ${slide.index} 页（HTTP ${response.status}）`)
          continue
        }
        const declaredLength = Number(response.headers && response.headers.get ? response.headers.get('content-length') : 0)
        if (limits.maxImageBytes && declaredLength && declaredLength > limits.maxImageBytes) {
          skipped.push(`第 ${slide.index} 页（超过图片大小上限）`)
          continue
        }
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (limits.maxImageBytes && bytes.byteLength > limits.maxImageBytes) {
          skipped.push(`第 ${slide.index} 页（超过图片大小上限）`)
          continue
        }
        const mediaType = detectImageMediaType(response.headers && response.headers.get ? response.headers.get('content-type') : '', bytes)
        if (!mediaType) {
          skipped.push(`第 ${slide.index} 页（图片格式不受支持）`)
          continue
        }
        const ref = await attachments.saveImage({ data: bytes, mediaType, name: `ykt-slide-${slide.index}` })
        // The conversation keeps this ref: never let a plugin lease delete it.
        retainImage(ref)
        images.push(ref)
      } catch (error) {
        skipped.push(`第 ${slide.index} 页（${(error && error.message) || error}）`)
      }
    }
    const note = skipped.length ? `\n未能附带：${skipped.join('、')}` : ''
    return { images, note }
  }

  // -------------------------------------------------------------------------
  // AI study engine: user-selected model, whole-lesson summaries, page chat
  // -------------------------------------------------------------------------
  const modelCatalogCache = { at: 0, data: null }
  // Downloaded slide bytes (memory only) so repeated questions on one page do
  // not refetch the CDN; attachments themselves are created per call and
  // deleted when the call ends (see createImageLease).
  const slideBytesCache = new Map()
  const leasedImages = new Map()
  const retainedImagePaths = new Set()
  const slideDataUrlCache = new Map()
  const summaryJobs = new Map()
  let summaryCachePromise = null
  let summaryWriteQueue = Promise.resolve()
  let registeredRouteCount = 0
  let aiSessionIdCache = ''

  /**
   * OpenCode routes require `x-opencode-session`; DSH's pi-ai adapter maps
   * GenerateOptions.sessionId onto that header. The plugin has no Agent of its
   * own for panel-initiated calls, so reuse a live session id when one exists
   * and otherwise use a stable plugin-local id.
   */
  /**
   * Session key for the plugin's own model calls (routing / prompt-cache
   * header only). It is a plugin-private id, never one of the user's DSH
   * conversation sessions, so these calls are not attributed to — or logged
   * under — a real conversation.
   */
  function aiSessionId() {
    if (!aiSessionIdCache) aiSessionIdCache = `dsh-study-coach-${randomUUID()}`
    return aiSessionIdCache
  }

  function aiOverride() {
    const provider = clampText(vget(config.aiProvider, ''), 120)
    const model = clampText(vget(config.aiModel, ''), 200)
    if (!provider || !model) return null
    return {
      provider,
      model,
      reasoningEffort: clampText(vget(config.aiReasoning, ''), 40) || undefined,
    }
  }

  function aiSelection() {
    const override = aiOverride()
    if (override) return override
    const defaultModel = ctx.get('agentDefaultModel')
    if (defaultModel && typeof defaultModel.currentSelection === 'function') {
      try {
        const current = ai.normalizeSelection(defaultModel.currentSelection())
        // Keep the model route only; a global "max" reasoning effort would make
        // dozens of slide-reading calls unnecessarily slow. Plugin config may
        // still pin an effort explicitly via aiReasoning.
        if (current) return { provider: current.provider, model: current.model }
      } catch {
        /* fall through to the actionable error */
      }
    }
    throw new ai.AiError('尚未选择 AI 模型。请在雨课堂面板顶部的「模型」下拉框中选择一个模型。', {
      code: 'NO_MODEL',
      nextAction: 'choose-model',
    })
  }

  async function aiModelCatalog(force) {
    const llm = ctx.get('llm')
    if (!llm || typeof llm.listProviders !== 'function') {
      return { providers: [], error: '当前宿主没有可用的 AI 模型服务' }
    }
    const now = Date.now()
    if (!force && modelCatalogCache.data && now - modelCatalogCache.at < 60_000) return modelCatalogCache.data
    let providers = []
    let catalogError = ''
    try {
      providers = await llm.listProviders()
    } catch (error) {
      catalogError = `读取模型列表失败：${(error && error.message) || String(error)}`
      providers = []
    }
    const result = []
    for (const raw of providers) {
      const id = String((raw && (raw.id || raw.provider)) || '')
      if (!id) continue
      const entry = { id, name: String((raw && raw.name) || id), models: [] }
      try {
        const models = await llm.listModels(id)
        entry.models = (Array.isArray(models) ? models : []).map((model) => {
          const modalities = Array.isArray(model.inputModalities) ? model.inputModalities.map(String) : []
          return {
            id: String(model.id || ''),
            name: String(model.name || model.id || ''),
            description: String(model.description || ''),
            inputModalities: modalities,
            vision: modalities.indexOf('image') >= 0,
            contextWindow: Number(model.contextWindow) || undefined,
          }
        }).filter((model) => model.id)
      } catch (error) {
        entry.error = (error && error.message) || String(error)
      }
      if (entry.models.length || !entry.error) result.push(entry)
    }
    // Put the current default provider/model first so the picker opens on a
    // usable route instead of an arbitrary provider's first text-only model.
    let preferred = null
    try { preferred = aiSelection() } catch { /* no default model */ }
    if (preferred) {
      for (const entry of result) {
        entry.models.sort((left, right) => Number(right.vision === true) - Number(left.vision === true))
      }
      result.sort((left, right) => {
        if (left.id === preferred.provider && right.id !== preferred.provider) return -1
        if (right.id === preferred.provider && left.id !== preferred.provider) return 1
        return 0
      })
    }
    const data = { providers: result }
    if (catalogError) data.error = catalogError
    if (!result.some((provider) => provider.models.length)) {
      try {
        const current = aiSelection()
        let fallbackModalities = []
        try {
          const info = await llm.resolveModelInfo(current.provider, current.model)
          if (Array.isArray(info && info.inputModalities)) fallbackModalities = info.inputModalities.map(String)
        } catch {
          /* keep unknown and let dispatch decide */
        }
        data.providers = [
          {
            id: current.provider,
            name: current.provider,
            models: [
              {
                id: current.model,
                name: current.model,
                description: '当前默认模型',
                inputModalities: fallbackModalities.length ? fallbackModalities : undefined,
                vision: fallbackModalities.indexOf('image') >= 0,
              },
            ],
          },
        ]
      } catch {
        /* no model available */
      }
    }
    modelCatalogCache.at = now
    modelCatalogCache.data = data
    return data
  }

  async function saveAiSelection(input) {
    const body = isRecord(input) ? input : {}
    if (body.reset === true || (!body.provider && !body.model)) {
      await settings.update(ownEntryId, { aiProvider: '', aiModel: '', aiReasoning: '' })
      return { reset: true, effective: aiSelection() }
    }
    const selection = ai.normalizeSelection(body)
    if (!selection) throw new ykt.YktError('模型选择无效：provider 与 model 都不能为空')
    const catalog = await aiModelCatalog(false)
    const provider = catalog.providers.filter((item) => item.id === selection.provider)[0]
    if (!provider) throw new ykt.YktError(`未知的模型提供方：${selection.provider}`)
    const model = provider.models.filter((item) => item.id === selection.model)[0]
    if (!model) throw new ykt.YktError(`模型 ${selection.model} 不在 ${selection.provider} 的可用列表中`)
    await settings.update(ownEntryId, {
      aiProvider: selection.provider,
      aiModel: selection.model,
      aiReasoning: selection.reasoningEffort || '',
    })
    return { selection, effective: aiSelection() }
  }

  /**
   * The Host attachment store rejects an image whose declared media type does
   * not match its bytes (IMAGE_TYPE_MISMATCH). Yuketang's CDN frequently
   * serves PNG slides as `image/jpeg` (and vice versa), so the bytes are the
   * only reliable source; the response header is a last resort.
   */
  function detectImageMediaType(contentType, bytes) {
    if (bytes && bytes.length >= 4) {
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif'
      if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      ) return 'image/webp'
    }
    const normalized = String(contentType || '').split(';')[0].trim().toLowerCase()
    if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(normalized)) return normalized
    return ''
  }

  async function fetchImageWithTimeout(url, signal, timeoutMs = 20_000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    if (signal && signal.aborted) controller.abort()
    else if (signal) signal.addEventListener('abort', onAbort, { once: true })
    try {
      return await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
  }

  /**
   * Download one slide image from the Yuketang CDN (allow-listed host only).
   * Shared by the attachment path and the local `slide-image` route the
   * viewer uses to composite annotations onto the page.
   */
  async function fetchSlideImage(slide, signal, maxBytes) {
    const url = ykt.slideImageUrl(slide.cover)
    if (!url) throw new ykt.YktError(`第 ${slide.index} 页没有可读取的图片`)
    if (!ykt.isAllowedSlideUrl(url)) throw new ykt.YktError(`第 ${slide.index} 页图片地址不在雨课堂域名下，已拒绝`)
    let response
    try {
      response = await fetchImageWithTimeout(url, signal)
    } catch (error) {
      throw new ai.AiError(`第 ${slide.index} 页图片下载失败：${(error && error.message) || String(error)}`, { code: 'IMAGE_FETCH' })
    }
    if (!response.ok) throw new ai.AiError(`第 ${slide.index} 页图片下载失败（HTTP ${response.status}）`, { code: 'IMAGE_FETCH' })
    const declaredLength = Number(response.headers && response.headers.get ? response.headers.get('content-length') : 0)
    if (maxBytes && declaredLength && declaredLength > maxBytes) throw new ai.AiError(`第 ${slide.index} 页图片超过大小上限`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (maxBytes && bytes.byteLength > maxBytes) throw new ai.AiError(`第 ${slide.index} 页图片超过大小上限`)
    if (!bytes.byteLength) throw new ai.AiError(`第 ${slide.index} 页图片为空`, { code: 'IMAGE_FETCH' })
    const mediaType = detectImageMediaType(response.headers && response.headers.get ? response.headers.get('content-type') : '', bytes)
    if (!mediaType) {
      throw new ai.AiError(`第 ${slide.index} 页图片格式不受支持（仅支持 PNG/JPEG/WebP/GIF）`, { code: 'IMAGE_FORMAT' })
    }
    return { bytes, mediaType }
  }

  async function slideBytes(slide, signal, maxBytes) {
    const key = String(slide.cover || '')
    if (key && slideBytesCache.has(key)) {
      const hit = slideBytesCache.get(key)
      slideBytesCache.delete(key)
      slideBytesCache.set(key, hit)
      return hit
    }
    const fetched = await fetchSlideImage(slide, signal, maxBytes)
    if (key) {
      slideBytesCache.set(key, fetched)
      while (slideBytesCache.size > 24) slideBytesCache.delete(slideBytesCache.keys().next().value)
    }
    return fetched
  }

  async function saveSlideAttachment(presentationId, slide, signal, lease) {
    const attachments = ctx.get('attachments')
    if (!attachments || typeof attachments.saveImage !== 'function') {
      throw new ai.AiError('当前宿主没有图片附件服务，无法让 AI 阅读课件图片。')
    }
    const limits = attachments.imageLimits || {}
    const { bytes, mediaType } = await slideBytes(slide, signal, limits.maxImageBytes)
    try {
      const save = () => attachments.saveImage({ data: bytes, mediaType, name: `ykt-slide-${presentationId}-${slide.index}` })
      return lease ? await lease.track(save) : await save()
    } catch (error) {
      const code = (error && error.code) || ''
      throw new ai.AiError(`第 ${slide.index} 页图片无法保存为附件：${(error && error.message) || String(error)}${code ? `（${code}）` : ''}`, { code: code || 'ATTACHMENT_FAILED' })
    }
  }

  // ---- Use-and-delete image leases ------------------------------------------
  // The host attachment store is content-addressed and has no delete API, but
  // it exposes each object's path. A lease records the objects a single model
  // call created; when the call ends they are removed again, together with the
  // provider-sized copies the host cached for that request. Objects that
  // already existed (e.g. the same image in a chat), that another in-flight
  // call still uses, or that the ykt tool handed to the conversation are kept.
  function imagePathOf(ref) {
    try {
      const store = ctx.get('attachments')
      return ref && store && typeof store.imageHostPath === 'function' ? String(store.imageHostPath(ref) || '') : ''
    } catch {
      return ''
    }
  }

  function retainImage(ref) {
    const path = imagePathOf(ref)
    if (!path) return
    retainedImagePaths.add(path)
    if (retainedImagePaths.size > 4000) retainedImagePaths.delete(retainedImagePaths.values().next().value)
  }

  async function removeStoredFile(path) {
    try { await chmod(path, 0o644) } catch { /* may already be writable or gone */ }
    try {
      await unlink(path)
    } catch {
      return
    }
    try { await rmdir(dirname(path)) } catch { /* shard directory still in use */ }
  }

  function requestImageCacheRoot() {
    const store = ctx.get('attachments')
    if (!store) return ''
    if (typeof store.cacheRoot === 'string' && store.cacheRoot) return join(store.cacheRoot, 'request-images')
    if (typeof store.root === 'string' && store.root) return join(dirname(dirname(store.root)), 'cache', 'attachments', 'request-images')
    return ''
  }

  /** Drop provider-sized request copies written since `since` (a pure cache). */
  async function sweepRequestImageCache(since) {
    const root = requestImageCacheRoot()
    if (!root) return
    let shards = []
    try { shards = await readdir(root) } catch { return }
    for (const shard of shards) {
      const dir = join(root, shard)
      let names = []
      try { names = await readdir(dir) } catch { continue }
      for (const name of names) {
        const file = join(dir, name)
        try {
          const info = await stat(file)
          if (info.isFile() && info.mtimeMs >= since - 2000) await removeStoredFile(file)
        } catch { /* raced with another sweep */ }
      }
    }
  }

  function releaseLeasedPath(path) {
    const entry = leasedImages.get(path)
    if (!entry) return null
    entry.uses -= 1
    if (entry.uses > 0) return null
    leasedImages.delete(path)
    if (!entry.created || retainedImagePaths.has(path)) return null
    return removeStoredFile(path)
  }

  function createImageLease() {
    const startedAt = Date.now()
    const paths = []
    let released = false
    return {
      async track(save) {
        const before = Date.now()
        const ref = await save()
        const path = imagePathOf(ref)
        if (!path) return ref
        let created = false
        try {
          const info = await stat(path)
          const born = Number(info.birthtimeMs) > 0 ? Number(info.birthtimeMs) : Number(info.ctimeMs)
          created = born >= before - 1500
        } catch {
          created = false
        }
        const entry = leasedImages.get(path) || { uses: 0, created: false }
        entry.uses += 1
        if (created) entry.created = true
        leasedImages.set(path, entry)
        if (released) await releaseLeasedPath(path)
        else paths.push(path)
        return ref
      },
      async release() {
        if (released) return
        released = true
        const pending = paths.splice(0).map(releaseLeasedPath).filter(Boolean)
        await Promise.all(pending)
        await sweepRequestImageCache(startedAt).catch(() => {})
      },
    }
  }

  async function saveDataUrlImage(value, name, lease) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(value || ''))
    if (!match) return null
    const attachments = ctx.get('attachments')
    if (!attachments || typeof attachments.saveImage !== 'function') return null
    const limits = attachments.imageLimits || {}
    const bytes = new Uint8Array(Buffer.from(match[2], 'base64'))
    const maxBytes = Math.min(4 * 1024 * 1024, Number(limits.maxImageBytes) || Infinity)
    if (!bytes.byteLength || bytes.byteLength > maxBytes) return null
    const save = () => attachments.saveImage({ data: bytes, mediaType: match[1], name: name || 'ykt-annotation' })
    return lease ? lease.track(save) : save()
  }

  /** Per-message image budget the host allows (defaults to a generous 8). */
  function imageBudget() {
    const attachments = ctx.get('attachments')
    const limits = (attachments && attachments.imageLimits) || {}
    const max = Number(limits.maxImagesPerMessage)
    return Number.isFinite(max) && max > 0 ? Math.floor(max) : 8
  }

  /** Normalise a client-sent focus region box into 0–1 page coordinates. */
  function cleanFocusBox(box) {
    if (!isRecord(box)) return null
    const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0))
    const x0 = clamp(box.x0)
    const y0 = clamp(box.y0)
    const x1 = clamp(box.x1)
    const y1 = clamp(box.y1)
    if (x1 <= x0 || y1 <= y0) return null
    return { x0, y0, x1, y1 }
  }

  function summaryDataDir() {
    return process.env.DSH_STUDY_COACH_DATA || join(homedir(), '.dsh-study-coach')
  }

  async function loadSummaryCache() {
    if (summaryCachePromise) return summaryCachePromise
    summaryCachePromise = (async () => {
      try {
        const file = join(summaryDataDir(), 'summaries.json')
        const raw = await readFile(file, 'utf8')
        const parsed = JSON.parse(raw)
        const summaries = isRecord(parsed) && isRecord(parsed.summaries) ? parsed.summaries : {}
        // Drop legacy unscoped entries (they predate account-scoped keys).
        for (const key of Object.keys(summaries)) {
          if (key.indexOf('||') < 0) delete summaries[key]
        }
        return summaries
      } catch {
        return {}
      }
    })()
    return summaryCachePromise
  }

  function saveSummaryCache(cache) {
    const entries = Object.entries(cache)
      .sort((left, right) => (Number(right[1] && right[1].updatedAt) || 0) - (Number(left[1] && left[1].updatedAt) || 0))
      .slice(0, MAX_SUMMARY_CACHE)
    const write = summaryWriteQueue.then(async () => {
      const dir = summaryDataDir()
      await mkdir(dir, { recursive: true })
      const file = join(dir, 'summaries.json')
      const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`
      await writeFile(temp, JSON.stringify({ version: 1, summaries: Object.fromEntries(entries) }, null, 2), { encoding: 'utf8', mode: 0o600 })
      await rename(temp, file)
    })
    summaryWriteQueue = write.catch(() => {})
    return write
  }

  // ---- Saved chats (text only) ----------------------------------------------
  let chatCachePromise = null
  let chatWriteQueue = Promise.resolve()

  async function loadChatStore() {
    if (chatCachePromise) return chatCachePromise
    chatCachePromise = (async () => {
      try {
        const raw = await readFile(join(summaryDataDir(), 'chats.json'), 'utf8')
        const parsed = JSON.parse(raw)
        return isRecord(parsed) && isRecord(parsed.lessons) ? parsed.lessons : {}
      } catch {
        return {}
      }
    })()
    return chatCachePromise
  }

  function saveChatStore(lessons) {
    const entries = Object.entries(lessons)
      .sort((left, right) => (Number(right[1] && right[1].updatedAt) || 0) - (Number(left[1] && left[1].updatedAt) || 0))
      .slice(0, MAX_CHAT_LESSONS)
    for (const key of Object.keys(lessons)) delete lessons[key]
    for (const [key, value] of entries) lessons[key] = value
    const write = chatWriteQueue.then(async () => {
      const dir = summaryDataDir()
      await mkdir(dir, { recursive: true })
      const file = join(dir, 'chats.json')
      if (!entries.length) {
        try { await unlink(file) } catch { /* nothing saved */ }
        return
      }
      const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`
      await writeFile(temp, JSON.stringify({ version: 1, lessons: Object.fromEntries(entries) }), { encoding: 'utf8', mode: 0o600 })
      await rename(temp, file)
    })
    chatWriteQueue = write.catch(() => {})
    return write
  }

  function cleanChatMessages(value) {
    return (Array.isArray(value) ? value : [])
      .filter((item) => isRecord(item) && (item.role === 'user' || item.role === 'assistant'))
      .map((item) => ({ role: item.role, text: clampText(item.text, MAX_CHAT_MESSAGE_CHARS) }))
      .filter((item) => item.text)
      .slice(-MAX_CHAT_MESSAGES_PER_THREAD)
  }

  async function loadLessonChats(lessonId) {
    const lessons = await loadChatStore()
    const entry = lessons[scopedLessonKey(lessonId)]
    const pick = (threads) => {
      const out = {}
      if (!isRecord(threads)) return out
      for (const [key, thread] of Object.entries(threads)) {
        const messages = cleanChatMessages(thread && thread.messages)
        if (messages.length) out[key] = messages
      }
      return out
    }
    return { page: pick(entry && entry.page), board: pick(entry && entry.board) }
  }

  async function saveLessonChat(lessonId, kind, threadKey, messages) {
    if (kind !== 'page' && kind !== 'board') throw new ykt.YktError('chats/save 的 kind 只能是 page 或 board')
    const key = clampText(threadKey, 200)
    if (!key) throw new ykt.YktError('chats/save 需要 key')
    const lessons = await loadChatStore()
    const lessonKey = scopedLessonKey(lessonId)
    const entry = isRecord(lessons[lessonKey]) ? lessons[lessonKey] : { page: {}, board: {} }
    if (!isRecord(entry[kind])) entry[kind] = {}
    const clean = cleanChatMessages(messages)
    if (clean.length) entry[kind][key] = { messages: clean, updatedAt: Date.now() }
    else delete entry[kind][key]
    for (const group of ['page', 'board']) {
      if (!isRecord(entry[group])) entry[group] = {}
      const threads = Object.entries(entry[group])
        .sort((left, right) => (Number(right[1] && right[1].updatedAt) || 0) - (Number(left[1] && left[1].updatedAt) || 0))
        .slice(0, MAX_CHAT_THREADS_PER_LESSON)
      entry[group] = Object.fromEntries(threads)
    }
    if (Object.keys(entry.page).length || Object.keys(entry.board).length) {
      entry.updatedAt = Date.now()
      lessons[lessonKey] = entry
    } else {
      delete lessons[lessonKey]
    }
    await saveChatStore(lessons)
  }

  async function clearChats(lessonId, scope) {
    const lessons = await loadChatStore()
    if (lessonId) delete lessons[scopedLessonKey(lessonId)]
    else {
      for (const key of Object.keys(lessons)) {
        if (key.indexOf(`${scope || yktScopeKey()}||`) === 0) delete lessons[key]
      }
    }
    await saveChatStore(lessons)
  }

  async function getCachedSummary(lessonId) {
    const cache = await loadSummaryCache()
    return cache[scopedLessonKey(lessonId)] || null
  }

  async function clearSummaryScope(scope) {
    for (const [key, job] of [...summaryJobs.entries()]) {
      if (key.indexOf(`${scope}||`) !== 0) continue
      try { job.controller.abort() } catch { /* already done */ }
      summaryJobs.delete(key)
    }
    slideBytesCache.clear()
    const cache = await loadSummaryCache()
    let changed = false
    for (const key of Object.keys(cache)) {
      if (key.indexOf(`${scope}||`) !== 0) continue
      delete cache[key]
      changed = true
    }
    if (changed) await saveSummaryCache(cache)
    await clearChats('', scope)
  }

  function publicJob(job) {
    return {
      lessonId: job.lessonId,
      status: job.status,
      phase: job.phase,
      message: job.message,
      progress: Math.max(0, Math.min(1, Number(job.progress) || 0)),
      totalSlides: Number(job.totalSlides) || 0,
      excludedSlides: Number(job.excludedSlides) || 0,
      readSlides: Number(job.readSlides) || 0,
      title: job.title || '',
      courseName: job.courseName || '',
      model: job.model || null,
      error: job.error || '',
      warnings: Array.isArray(job.warnings) ? job.warnings : [],
      result: job.result || null,
      // Live board while the job runs; once done it travels inside result.board.
      board: job.status === 'done' ? null : job.board || null,
      cached: job.cached === true,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt,
    }
  }

  function updateJob(job, patch) {
    Object.assign(job, patch)
    job.updatedAt = Date.now()
  }

  async function collectLessonSlides(client, lessonId, info, lessonSummary, signal) {
    const byId = new Map()
    for (const presentation of lessonSummary.presentations) {
      if (presentation && presentation.id) byId.set(presentation.id, presentation)
    }
    for (const id of info.presentationIds || []) {
      if (id && !byId.has(id)) byId.set(id, { id, title: info.lessonName || '课件' })
    }
    const presentations = [...byId.values()]
    const collected = []
    const warnings = []
    for (const presentation of presentations) {
      if (signal && signal.aborted) throw new ai.AiError('模型调用已取消', { code: 'ABORTED' })
      try {
        const slides = await ykt.listSlides(client, presentation.id, lessonId)
        for (const slide of slides) {
          collected.push({
            presentationId: presentation.id,
            presentationTitle: presentation.title || '',
            slide,
          })
        }
      } catch (error) {
        warnings.push(`${presentation.title || presentation.id}：${(error && error.message) || String(error)}`)
      }
      if (collected.length >= MAX_SUMMARY_SLIDES) break
    }
    return { slides: collected.slice(0, MAX_SUMMARY_SLIDES), warnings }
  }

  async function readLessonContext(client, lessonId, signal) {
    const context = { replayPages: [], mindMapText: '', lectureNoteText: '' }
    if (signal && signal.aborted) throw new ai.AiError('模型调用已取消', { code: 'ABORTED' })
    try {
      const replay = await ykt.getReplayTimeline(client, lessonId)
      context.replayPages = Array.isArray(replay.shownSlideIndexes) ? replay.shownSlideIndexes : []
    } catch {
      /* optional */
    }
    if (signal && signal.aborted) throw new ai.AiError('模型调用已取消', { code: 'ABORTED' })
    try {
      const mindMap = await ykt.getMindMap(client, lessonId)
      if (mindMap) context.mindMapText = JSON.stringify(mindMap).slice(0, 12_000)
    } catch {
      /* optional */
    }
    if (signal && signal.aborted) throw new ai.AiError('模型调用已取消', { code: 'ABORTED' })
    try {
      const notes = await ykt.listLectureNotes(client, lessonId)
      if (notes.notes && notes.notes.length) {
        try {
          const detail = await ykt.getLectureNoteDetail(client, lessonId, notes.notes[0].liveId)
          context.lectureNoteText = JSON.stringify(detail).slice(0, 16_000)
        } catch {
          context.lectureNoteText = notes.notes
            .map((note) => `笔记 ${note.liveId}，时长 ${Math.round((Number(note.durationMs) || 0) / 60_000)} 分钟`)
            .join('\n')
        }
      }
    } catch {
      /* optional */
    }
    return context
  }

  /**
   * Grows the job's knowledge board while slides are still being read.
   *
   * Notes arrive in whatever order batches finish; they are queued and fed to
   * the model one call at a time (coalescing up to three batches per call), so
   * every call sees the board as it stands and ids never race. Each streamed
   * JSON Lines operation is applied the moment its line completes, which is
   * what makes nodes appear one by one in the panel. Board failures never fail
   * the summary: they only add a warning.
   */
  function createTreeGrower(job, llm, selection, signal) {
    const board = ai.createBoard()
    job.board = board
    const pending = []
    let running = null
    let stopped = false
    let failures = 0
    const warn = (text) => {
      job.warnings = Array.isArray(job.warnings) ? job.warnings.concat([text]) : [text]
    }
    const grow = async (notes) => {
      const parser = ai.createTreeOpParser((op) => {
        if (ai.applyTreeOp(board, op)) {
          board.version += 1
          job.updatedAt = Date.now()
        }
      })
      await ai.streamText(llm, selection, {
        system: ai.TREE_SYSTEM,
        sessionId: aiSessionId(),
        messages: [{ role: 'user', content: [{ type: 'text', text: ai.buildTreePrompt({ courseName: job.courseName, lessonTitle: job.title, board, notes }) }] }],
        maxTokens: 3_000,
        temperature: 0.2,
        signal,
        onText: (delta) => parser.push(delta),
      })
      parser.end()
    }
    const schedule = () => {
      if (running || stopped || !pending.length) return
      running = (async () => {
        while (pending.length && !stopped && !signal.aborted) {
          const chunk = pending.splice(0, 3)
          for (let attempt = 0; ; attempt += 1) {
            try {
              await grow(chunk.map((item) => item.slice(0, 12_000)).join('\n\n'))
              break
            } catch (error) {
              if (signal.aborted || stopped) return
              if (ai.isRateLimitError(error) && attempt < RATE_LIMIT_RETRIES) {
                await sleep(RATE_LIMIT_BACKOFF_MS * (attempt + 1), signal)
                continue
              }
              failures += 1
              warn(`知识看板有一部分没能生成：${(error && error.message) || String(error)}`)
              if (failures >= 3) stopped = true
              break
            }
          }
        }
      })().finally(() => {
        running = null
        schedule()
      })
    }
    return {
      board,
      enqueue(notes) {
        if (stopped || !notes) return
        pending.push(String(notes))
        schedule()
      },
      busy() {
        return !!running || (!stopped && pending.length > 0)
      },
      async drain() {
        while (running) await running
      },
      stop() {
        stopped = true
        pending.length = 0
      },
      snapshot() {
        return Object.keys(board.nodes).length ? JSON.parse(JSON.stringify(board)) : null
      },
    }
  }

  /**
   * Normalise the client's unticked pages, `{ [presentationId]: [pageIndex] }`,
   * into a Set of "presentationId:index" keys.
   */
  function summaryExclusions(value) {
    const keys = new Set()
    if (!isRecord(value)) return keys
    for (const presentationId of Object.keys(value).slice(0, 50)) {
      const pages = Array.isArray(value[presentationId]) ? value[presentationId] : []
      for (const page of pages.slice(0, 2000)) {
        const index = Number(page)
        if (Number.isInteger(index) && index > 0) keys.add(`${String(presentationId)}:${index}`)
      }
    }
    return keys
  }

  async function runSummaryJob(job, input) {
    const signal = job.controller.signal
    let treeGrower = null
    try {
      if (signal.aborted) {
        updateJob(job, { status: 'cancelled', phase: 'cancelled', message: '已取消' })
        return
      }
      job.status = 'running'
      job.updatedAt = Date.now()
      const llm = ctx.get('llm')
      if (!llm) throw new ai.AiError('当前宿主没有可用的 AI 模型服务')
      job.model = aiSelection()
      const client = await yktClient()
      updateJob(job, { phase: 'prepare', progress: 0.02, message: '读取课时与课件结构…' })
      const [info, lessonSummary] = await Promise.all([
        ykt.getLessonInfo(client, job.lessonId),
        ykt.getLessonSummary(client, job.lessonId),
      ])
      job.title = info.lessonName || lessonSummary.lessonTitle || job.lessonId
      job.courseName = info.courseName || ''
      const declaredSlideCount = lessonSummary.presentations.reduce((total, item) => total + (Number(item.slidesCount) || 0), 0)
      updateJob(job, { phase: 'prepare', progress: 0.05, message: '收集全部课件页面…' })
      const collected = await collectLessonSlides(client, job.lessonId, info, lessonSummary, signal)
      // Pages the student unticked in the panel never reach the model.
      const exclude = summaryExclusions(input && input.exclude)
      let slides = exclude.size
        ? collected.slides.filter((item) => !exclude.has(`${item.presentationId}:${Number(item.slide && item.slide.index)}`))
        : collected.slides
      if (Number(job.maxSlides) > 0) {
        slides = slides.slice(0, Math.max(1, Math.min(MAX_SUMMARY_SLIDES, Math.floor(Number(job.maxSlides)))))
      }
      const excludedCount = collected.slides.length - slides.length
      job.excludedSlides = excludedCount
      job.warnings = collected.warnings
      job.totalSlides = slides.length
      if (!slides.length && excludedCount) {
        throw new ai.AiError('所有课件页都被取消勾选了，请至少勾选一页再总结。', { code: 'NO_SLIDES_SELECTED' })
      }
      if (!slides.length) {
        throw new ai.AiError(
          '该课时没有可读取的课件页面，无法生成总结。' +
            (job.warnings && job.warnings.length ? `（${job.warnings.slice(0, 3).join('；')}）` : ''),
        )
      }

      // Resolve the exact model once: it decides image support and which
      // reasoning efforts exist. Reading slides is transcription work, so it
      // uses the model's cheapest effort; the final synthesis uses "high".
      // A user-pinned effort (plugin config aiReasoning) wins for both.
      let modelInfo = null
      try {
        modelInfo = typeof llm.resolveModelInfo === 'function' ? await llm.resolveModelInfo(job.model.provider, job.model.model, signal) : null
      } catch {
        modelInfo = null
      }
      const pinnedEffort = job.model.reasoningEffort
      const withEffort = (effort) => {
        const selection = { provider: job.model.provider, model: job.model.model }
        if (effort) selection.reasoningEffort = effort
        return selection
      }
      const readSelection = withEffort(pinnedEffort || ai.pickReasoningEffort(modelInfo, 'least'))
      const composeSelection = withEffort(pinnedEffort || ai.pickReasoningEffort(modelInfo, 'high'))

      const attachmentService = ctx.get('attachments')
      const perMessageLimit = attachmentService && attachmentService.imageLimits && Number(attachmentService.imageLimits.maxImagesPerMessage)
      const batchSize = Math.max(1, Math.min(SLIDES_PER_BATCH, Number.isFinite(perMessageLimit) && perMessageLimit > 0 ? perMessageLimit : SLIDES_PER_BATCH))
      const presentationTotals = new Map()
      for (const item of slides) {
        presentationTotals.set(item.presentationId, (presentationTotals.get(item.presentationId) || 0) + 1)
      }
      // Batches never span two presentations, so each prompt's page range and
      // title stay accurate.
      const batches = []
      for (let offset = 0; offset < slides.length;) {
        const presentationId = slides[offset].presentationId
        let end = offset + 1
        while (end < slides.length && end - offset < batchSize && slides[end].presentationId === presentationId) end += 1
        batches.push(slides.slice(offset, end))
        offset = end
      }

      // One failing batch stops the others; the job's own signal still wins.
      const readController = new AbortController()
      const abortRead = () => readController.abort()
      if (signal.aborted) readController.abort()
      else signal.addEventListener('abort', abortRead, { once: true })
      const readSignal = readController.signal
      const throwIfStopped = () => {
        if (signal.aborted || readSignal.aborted) throw new ai.AiError('模型调用已取消', { code: 'ABORTED' })
      }

      // Image download + attachment save, shared by all batches and bounded so
      // prefetching never floods the CDN.
      const fetchLimit = createLimiter(SLIDE_FETCH_CONCURRENCY)
      const prepared = new Map()
      const batchLeases = new Map()
      const releaseBatch = (batchIndex) => {
        const lease = batchLeases.get(batchIndex)
        if (!lease) return Promise.resolve()
        batchLeases.delete(batchIndex)
        return lease.release().catch(() => {})
      }
      const prepareBatch = (batchIndex) => {
        if (batchIndex >= batches.length) return null
        if (prepared.has(batchIndex)) return prepared.get(batchIndex)
        const batch = batches[batchIndex]
        const lease = createImageLease()
        batchLeases.set(batchIndex, lease)
        const task = Promise.all(batch.map((item) => fetchLimit(async () => {
          if (readSignal.aborted) return { item, error: '已取消' }
          try {
            return { item, ref: await saveSlideAttachment(item.presentationId, item.slide, readSignal, lease) }
          } catch (error) {
            return { item, error: (error && error.message) || String(error) }
          }
        })))
        prepared.set(batchIndex, task)
        return task
      }

      const batchNotes = new Array(batches.length)
      treeGrower = createTreeGrower(job, llm, readSelection, signal)
      let doneSlides = 0
      let doneBatches = 0
      let fatal = null
      let workerLimit = Math.min(SUMMARY_READ_CONCURRENCY, batches.length)
      let nextBatch = 0
      const reportProgress = () => {
        updateJob(job, {
          phase: 'read',
          progress: 0.05 + 0.82 * (doneSlides / slides.length),
          message: `AI 正在并行阅读课件（${Math.min(workerLimit, batches.length - doneBatches) || 1} 路）：已读完 ${doneSlides} / ${slides.length} 页…`,
        })
      }

      const readBatch = async (batchIndex) => {
        const batch = batches[batchIndex]
        const presentationId = batch[0].presentationId
        const from = Number(batch[0].slide.index) || 1
        const to = Number(batch[batch.length - 1].slide.index) || from + batch.length - 1
        const results = await prepareBatch(batchIndex)
        throwIfStopped()
        // Warm the images of the batch that will be read after the ones in flight.
        prepareBatch(batchIndex + workerLimit)
        const blocks = [
          {
            type: 'text',
            text: ai.buildSlideNotesPrompt({
              courseName: job.courseName,
              lessonTitle: job.title,
              presentationTitle: batch[0].presentationTitle,
              from,
              to,
              total: presentationTotals.get(presentationId) || slides.length,
              pages: batch.map((item) => Number(item.slide.index)),
            }),
          },
        ]
        const missing = []
        let attachedCount = 0
        for (const result of results) {
          if (result.ref) {
            blocks.push({ type: 'image', attachment: result.ref })
            attachedCount += 1
          } else {
            const warning = `第 ${result.item.slide.index} 页（图片不可用：${result.error}）`
            missing.push(warning)
            job.warnings = Array.isArray(job.warnings) ? job.warnings.concat([warning]) : [warning]
          }
        }
        if (attachedCount === 0) {
          throw new ai.AiError(
            `第 ${from}–${to} 页课件图片都无法读取，无法交给 AI 阅读。原因：${(results[0] && results[0].error) || '未知'}`,
            { code: 'NO_SLIDE_IMAGES' },
          )
        }
        let read
        for (let attempt = 0; ; attempt += 1) {
          throwIfStopped()
          try {
            read = await ai.streamText(llm, readSelection, {
              system: ai.SUMMARY_SYSTEM,
              sessionId: aiSessionId(),
              messages: [{ role: 'user', content: blocks }],
              maxTokens: 5_000,
              temperature: 0.2,
              requireImage: true,
              modelInfo: modelInfo || undefined,
              signal: readSignal,
            })
            break
          } catch (error) {
            if (!ai.isRateLimitError(error) || attempt >= RATE_LIMIT_RETRIES || signal.aborted) throw error
            // The provider is throttling: run fewer batches at once and back off.
            workerLimit = Math.max(1, workerLimit - 1)
            reportProgress()
            await sleep(RATE_LIMIT_BACKOFF_MS * (attempt + 1), readSignal)
          }
        }
        const title = batch[0].presentationTitle ? `【${batch[0].presentationTitle}】\n` : ''
        batchNotes[batchIndex] = [...missing, `${title}${read.text}`].join('\n')
        treeGrower.enqueue(`${title}${read.text}`)
        job.readSlides = Math.min(slides.length, (job.readSlides || 0) + attachedCount)
        doneSlides += batch.length
        doneBatches += 1
        reportProgress()
      }

      const worker = async (workerId) => {
        while (!fatal && !readSignal.aborted) {
          // Workers above the (possibly lowered) limit retire after their batch.
          if (workerId >= workerLimit) return
          const batchIndex = nextBatch
          if (batchIndex >= batches.length) return
          nextBatch += 1
          try {
            await readBatch(batchIndex)
          } catch (error) {
            if (!fatal) fatal = error
            readController.abort()
            return
          } finally {
            // The batch's slide images are no longer needed once it is read.
            await releaseBatch(batchIndex)
          }
        }
      }

      reportProgress()
      try {
        await Promise.all(Array.from({ length: workerLimit }, (_, workerId) => worker(workerId)))
      } finally {
        signal.removeEventListener('abort', abortRead)
        // Prefetched batches that were never read (cancel / failure).
        await Promise.all([...prepared.values()].map((task) => task && task.catch(() => {})))
        await Promise.all([...batchLeases.keys()].map(releaseBatch))
      }
      if (signal.aborted) throw new ai.AiError('模型调用已取消', { code: 'ABORTED' })
      if (fatal) throw fatal
      const notes = batchNotes.filter(Boolean)
      // The board keeps growing while the final summary is composed.
      const treeDrained = treeGrower.drain()

      updateJob(job, { phase: 'compose', progress: 0.9, message: '正在整合知识点、考点与复习计划…' })
      const context = await readLessonContext(client, job.lessonId, signal)
      let notesText = notes.join('\n\n')
      if (notesText.length > 160_000) {
        notesText = notesText.slice(0, 160_000)
        job.warnings = Array.isArray(job.warnings) ? job.warnings.concat(['逐页笔记过长，最终整合仅使用前 160k 字符。']) : ['逐页笔记过长，最终整合仅使用前 160k 字符。']
      }
      const prompt = ai.buildSummaryPrompt({
        courseName: job.courseName,
        lessonTitle: job.title,
        notes: notesText,
        totalSlides: slides.length,
        excludedSlides: excludedCount,
        replayPages: context.replayPages,
        mindMapText: context.mindMapText,
        lectureNoteText: context.lectureNoteText,
      })
      const composed = await ai.streamText(llm, composeSelection, {
        system: ai.SUMMARY_SYSTEM,
        sessionId: aiSessionId(),
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        maxTokens: 9_000,
        temperature: 0.2,
        signal,
      })
      let summary = ai.parseSummaryJson(composed.text)
      if (!summary) {
        updateJob(job, { phase: 'compose', progress: 0.95, message: '正在重新整理为结构化结果…' })
        const retried = await ai.streamText(llm, composeSelection, {
          system: ai.SUMMARY_SYSTEM,
          sessionId: aiSessionId(),
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    '你上一条输出不是合法 JSON。请严格按下面的要求重新输出一个 JSON 对象，不要代码块、不要解释文字：\n\n' +
                    prompt +
                    '\n\n你上一条的输出（仅供参考，不要复述）：\n' +
                    composed.text.slice(0, 12_000),
                },
              ],
            },
          ],
          maxTokens: 9_000,
          temperature: 0.1,
          signal,
        })
        summary = ai.parseSummaryJson(retried.text)
      }
      if (!summary) summary = ai.fallbackSummary(composed.text, { title: job.title })
      if (treeGrower.busy()) updateJob(job, { phase: 'compose', progress: 0.97, message: '知识看板收尾中…' })
      await treeDrained
      await treeGrower.drain()
      const boardSnapshot = treeGrower.snapshot()
      if (boardSnapshot) summary.board = boardSnapshot
      summary.meta = {
        lessonId: job.lessonId,
        title: job.title,
        courseName: job.courseName,
        slideCount: job.readSlides || slides.length,
        readSlideCount: job.readSlides || 0,
        declaredSlideCount: declaredSlideCount || slides.length,
        excludedSlideCount: excludedCount,
        truncated: declaredSlideCount > slides.length + excludedCount,
        warnings: Array.isArray(job.warnings) ? job.warnings.slice(0, 10) : [],
        model: job.model,
        generatedAt: Date.now(),
      }
      if (signal.aborted || summaryJobs.get(job.key) !== job) {
        updateJob(job, { status: 'cancelled', phase: 'cancelled', message: '已取消' })
        return
      }
      const cache = await loadSummaryCache()
      cache[`${job.scopeKey || yktScopeKey()}||${job.lessonId}`] = { summary, updatedAt: Date.now() }
      try {
        await saveSummaryCache(cache)
      } catch (error) {
        const warning = `总结已生成，但本地缓存保存失败：${(error && error.message) || String(error)}`
        job.warnings = Array.isArray(job.warnings) ? job.warnings.concat([warning]) : [warning]
        summary.meta.warnings = Array.isArray(summary.meta.warnings) ? summary.meta.warnings.concat([warning]) : [warning]
      }
      job.result = summary
      updateJob(job, { status: 'done', phase: 'done', progress: 1, message: '总结完成' })
    } catch (error) {
      if (treeGrower) treeGrower.stop()
      if (signal.aborted || (error && error.code === 'ABORTED')) {
        updateJob(job, { status: 'cancelled', phase: 'cancelled', message: '已取消' })
      } else {
        job.status = 'error'
        const message = (error && error.message) || String(error)
        const code = error && typeof error.code === 'string' ? error.code : ''
        job.error = code && message.indexOf(code) < 0 ? `${message}（${code}）` : message
        job.message = '总结失败'
        job.updatedAt = Date.now()
      }
    }
  }

  function startSummaryJob(input) {
    const lessonId = String(input.lessonId || '')
    if (!lessonId) throw new ykt.YktError('summary/start 需要 lessonId')
    const key = scopedLessonKey(lessonId)
    const existing = summaryJobs.get(key)
    if (existing && (existing.status === 'queued' || existing.status === 'running')) return publicJob(existing)
    if (!aiSelection()) throw new ai.AiError('尚未选择 AI 模型')
    const job = {
      key,
      scopeKey: yktScopeKey(),
      lessonId,
      status: 'queued',
      phase: 'prepare',
      message: '已进入队列…',
      progress: 0.01,
      totalSlides: 0,
      readSlides: 0,
      title: '',
      courseName: '',
      model: null,
      error: '',
      result: null,
      cached: false,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      controller: new AbortController(),
    }
    summaryJobs.set(key, job)
    const done = [...summaryJobs.values()].filter((item) => item.status === 'done' || item.status === 'error' || item.status === 'cancelled')
    if (done.length > 20) {
      for (const item of done.slice(0, done.length - 20)) summaryJobs.delete(item.key)
    }
    void runSummaryJob(job, input)
    return publicJob(job)
  }

  /**
   * Same-origin copy of one slide image for the viewer. The CDN image cannot be
   * drawn onto a canvas and read back (cross-origin taint), so the viewer asks
   * for this data URL when it needs to crop the circled region for the AI.
   */
  async function slideImageDataUrl(input) {
    const lessonId = String(input.lessonId || '')
    const presentationId = String(input.presentationId || '')
    const slideIndex = Number(input.slideIndex) || 0
    if (!lessonId || !presentationId || !slideIndex) throw new ykt.YktError('slide-image 需要 lessonId、presentationId 与 slideIndex')
    const key = `${yktScopeKey()}||${presentationId}:${slideIndex}`
    if (slideDataUrlCache.has(key)) return slideDataUrlCache.get(key)
    const slides = await ykt.listSlides(await yktClient(), presentationId, lessonId)
    const slide = slides.filter((item) => Number(item.index) === slideIndex)[0]
    if (!slide) throw new ykt.YktError(`找不到第 ${slideIndex} 页`)
    const { bytes, mediaType } = await fetchSlideImage(slide, undefined, 8 * 1024 * 1024)
    const result = { dataUrl: `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`, mediaType }
    slideDataUrlCache.set(key, result)
    if (slideDataUrlCache.size > 24) {
      const oldest = slideDataUrlCache.keys().next().value
      if (oldest !== undefined) slideDataUrlCache.delete(oldest)
    }
    return result
  }

  async function pageChatAnswer(input) {
    const lessonId = String(input.lessonId || '')
    const presentationId = String(input.presentationId || '')
    const slideIndex = Number(input.slideIndex) || 0
    const question = clampText(input.question, 4_000)
    if (!lessonId || !presentationId) throw new ykt.YktError('page-chat 需要 lessonId 与 presentationId')
    if (!slideIndex) throw new ykt.YktError('page-chat 需要 slideIndex')
    if (!question) throw new ykt.YktError('请输入要问 AI 的问题')
    const llm = ctx.get('llm')
    if (!llm) throw new ai.AiError('当前宿主没有可用的 AI 模型服务')
    const selection = aiSelection()
    const client = await yktClient()
    const [info, slides] = await Promise.all([
      ykt.getLessonInfo(client, lessonId).catch(() => ({})),
      ykt.listSlides(client, presentationId, lessonId),
    ])
    if (!slides.length) throw new ykt.YktError('该课件没有可读取的页面')
    const slide = slides.filter((item) => Number(item.index) === slideIndex)[0] || slides[slideIndex - 1]
    if (!slide) throw new ykt.YktError(`找不到第 ${slideIndex} 页`)
    const pageIndex = Number(slide.index) || slideIndex
    const annotationText = clampText(input.annotationText, 2_000) || ai.describeAnnotations(input.annotations)

    // Image plan. When the student circled/highlighted something, the client
    // sends close-up crops of each marked region (page + strokes composited)
    // and the whole page with the strokes burnt in. The crops go FIRST so the
    // model reads the marked content at full resolution instead of skimming
    // the whole slide; the full page follows only as context.
    let budget = imageBudget()
    const images = []
    const lease = createImageLease()
    try {
    const focusList = (Array.isArray(input.focus) ? input.focus : []).filter(isRecord).slice(0, 3)
    for (const item of focusList) {
      if (budget <= 0) break
      // Keep one slot for the page itself unless the host allows a single image.
      if (images.length && budget <= 1) break
      try {
        const ref = await saveDataUrlImage(item.image, `ykt-focus-${presentationId}-${pageIndex}`, lease)
        if (!ref) continue
        images.push({ kind: 'focus', ref, box: cleanFocusBox(item.box) })
        budget -= 1
      } catch {
        /* a failed crop only weakens focus; the page image still follows */
      }
    }
    if (budget > 0) {
      let pageRef = null
      let marked = false
      if (input.marked) {
        try {
          pageRef = await saveDataUrlImage(input.marked, `ykt-marked-${presentationId}-${pageIndex}`, lease)
          marked = Boolean(pageRef)
        } catch {
          pageRef = null
        }
      }
      if (!pageRef) pageRef = await saveSlideAttachment(presentationId, slide, undefined, lease)
      images.push({ kind: 'page', ref: pageRef, marked })
      budget -= 1
      // Legacy clients: a transparent overlay is only useful next to an unmarked page.
      if (!marked && input.overlay && budget > 0 && !images.some((image) => image.kind === 'focus')) {
        try {
          const overlayRef = await saveDataUrlImage(input.overlay, 'ykt-annotation', lease)
          if (overlayRef) images.push({ kind: 'overlay', ref: overlayRef })
        } catch {
          /* annotation overlay is optional */
        }
      }
    }
    if (!images.length) images.push({ kind: 'page', ref: await saveSlideAttachment(presentationId, slide, undefined, lease), marked: false })

    const content = [
      {
        type: 'text',
        text: ai.buildPageChatText({
          courseName: info.courseName || '',
          lessonTitle: info.lessonName || '',
          pageIndex,
          pageCount: slides.length,
          question,
          annotationText,
          history: input.history,
          images: images.map((image) => ({ kind: image.kind, box: image.box || null, marked: Boolean(image.marked) })),
        }),
      },
    ]
    images.forEach((image, index) => {
      content.push({ type: 'text', text: ai.describePageChatImage(image, index) })
      content.push({ type: 'image', attachment: image.ref })
    })
    const answer = await ai.streamText(llm, selection, {
      system: ai.PAGE_CHAT_SYSTEM,
      sessionId: aiSessionId(),
      messages: [{ role: 'user', content }],
      maxTokens: 3_500,
      temperature: 0.3,
      requireImage: true,
    })
    return {
      answer: answer.text,
      model: selection,
      page: { index: pageIndex, count: slides.length },
      usage: answer.usage,
    }
    } finally {
      // Crops, marked page and slide copy are deleted as soon as the answer is in.
      await lease.release()
    }
  }

  /**
   * Answer a question about one knowledge-board node. The client sends the
   * node and its neighbourhood (path, children, siblings) because the board may
   * still be growing in a live job. When the model accepts images and the node
   * cites slides of the current presentation, up to three of those pages are
   * attached so the answer is grounded in the courseware.
   */
  async function boardChatAnswer(input) {
    const question = clampText(input.question, 4_000)
    if (!question) throw new ykt.YktError('请输入要问 AI 的问题')
    const node = isRecord(input.node) ? input.node : null
    if (!node || !clampText(node.label, 60)) throw new ykt.YktError('board-chat 需要选中的知识点')
    const llm = ctx.get('llm')
    if (!llm) throw new ai.AiError('当前宿主没有可用的 AI 模型服务')
    const selection = aiSelection()

    const images = []
    const lease = createImageLease()
    try {
    const lessonId = String(input.lessonId || '')
    const presentationId = String(input.presentationId || '')
    const pages = (Array.isArray(node.pages) ? node.pages : []).map(Number).filter((page) => Number.isInteger(page) && page > 0).slice(0, 3)
    let modelInfo = null
    if (lessonId && presentationId && pages.length) {
      try {
        modelInfo = typeof llm.resolveModelInfo === 'function' ? await llm.resolveModelInfo(selection.provider, selection.model) : null
      } catch {
        modelInfo = null
      }
      const modalities = modelInfo && Array.isArray(modelInfo.inputModalities) ? modelInfo.inputModalities : null
      if (modalities && modalities.indexOf('image') >= 0) {
        try {
          const slides = await ykt.listSlides(await yktClient(), presentationId, lessonId)
          for (const page of pages) {
            const slide = slides.filter((item) => Number(item.index) === page)[0]
            if (!slide) continue
            try {
              images.push({ page, ref: await saveSlideAttachment(presentationId, slide, undefined, lease) })
            } catch {
              /* a missing page image only weakens grounding */
            }
          }
        } catch {
          /* not logged in or slides unavailable: answer from the board alone */
        }
      }
    }

    const content = [
      {
        type: 'text',
        text: ai.buildBoardChatText({
          courseName: input.courseName,
          lessonTitle: input.lessonTitle,
          treeTitle: input.treeTitle,
          node,
          path: input.path,
          children: input.children,
          siblings: input.siblings,
          history: input.history,
          question,
          withImages: images.length > 0,
        }),
      },
    ]
    for (const image of images) {
      content.push({ type: 'text', text: `课件第 ${image.page} 页：` })
      content.push({ type: 'image', attachment: image.ref })
    }
    const answer = await ai.streamText(llm, selection, {
      system: ai.BOARD_CHAT_SYSTEM,
      sessionId: aiSessionId(),
      messages: [{ role: 'user', content }],
      maxTokens: 3_500,
      temperature: 0.3,
      requireImage: images.length > 0,
      modelInfo: modelInfo || undefined,
    })
    return { answer: answer.text, model: selection, pages: images.map((image) => image.page) }
    } finally {
      await lease.release()
    }
  }

  async function createSummaryCards(lessonId) {
    let record = await getCachedSummary(lessonId)
    if (!record || !record.summary) {
      const job = summaryJobs.get(scopedLessonKey(lessonId))
      if (job && job.result) record = { summary: job.result, updatedAt: job.updatedAt }
    }
    if (!record || !record.summary) throw new ykt.YktError('该课时还没有 AI 总结，请先生成总结。')
    const summary = record.summary
    const meta = summary.meta || {}
    const deck = `雨课堂 · ${String(meta.title || summary.title || '课时').slice(0, 40)}`
    const cards = ai.summaryToCards(summary, { deck, lessonTitle: meta.title })
    if (!cards.length) throw new ykt.YktError('总结中没有可转成复习卡片的条目。')
    const added = await serial(async () => {
      const snapshot = syncFromConfig()
      const existing = new Set(snapshot.cards.map((card) => `${card.deck || '默认'}\u0000${card.front}`))
      const fresh = cards.filter((card) => !existing.has(`${card.deck || '默认'}\u0000${card.front}`))
      if (!fresh.length) return 0
      if (snapshot.cards.length + fresh.length > MAX_CARDS) {
        throw new Error(`卡片数量上限为 ${MAX_CARDS} 张，请先删除一些卡片。`)
      }
      const now = Date.now()
      const created = fresh.map((card) => ({
        id: newCardId(),
        front: clampText(card.front, MAX_FRONT),
        back: clampText(card.back, MAX_BACK),
        deck: clampText(card.deck, 60) || '雨课堂',
        tags: Array.isArray(card.tags) ? card.tags.map((tag) => clampText(tag, 40)).filter(Boolean).slice(0, 8) : [],
        createdAt: now,
        due: now,
        interval: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        lastReview: null,
      }))
      await persist({ ...snapshot, cards: [...snapshot.cards, ...created] })
      return created.length
    })
    return { added, total: cards.length }
  }

  function statsText() {
    const snapshot = syncFromConfig()
    const stats = computeStats(snapshot, dailyGoal())
    const decks = new Map()
    for (const card of snapshot.cards) decks.set(card.deck, (decks.get(card.deck) || 0) + 1)
    const deckText = decks.size
      ? [...decks.entries()].map(([deck, count]) => `${deck}（${count}）`).join('、')
      : '暂无'
    return [
      `📚 学习进度`,
      `• 卡片总数：${stats.total}`,
      `• 今日待复习：${stats.due}`,
      `• 今日已复习：${stats.reviewedToday} / ${stats.dailyGoal}`,
      `• 连续学习：${stats.streak} 天`,
      `• 已掌握（间隔 ≥ 21 天）：${stats.mastered}`,
      `• 学习中：${stats.learning}`,
      `• 新卡片：${stats.fresh}`,
      `• 卡组：${deckText}`,
    ].join('\n')
  }

  function dueText(limit = 10, deck) {
    const snapshot = syncFromConfig()
    const now = Date.now()
    const allDue = snapshot.cards
      .filter((card) => card.due <= now && (!deck || card.deck === deck))
      .sort((a, b) => a.due - b.due)
    if (!allDue.length) return '今天没有到期的卡片。可以让我为你创建新卡片，或在「学习中心」里浏览卡片库。'
    const due = allDue.slice(0, limit)
    const more = allDue.length > due.length ? `（仅显示前 ${due.length} 张，共 ${allDue.length} 张）` : ''
    return [
      `今日待复习 ${allDue.length} 张${more}（按到期时间排序）：`,
      ...due.map((card, index) => `${index + 1}. [${card.id}] Q: ${card.front}\n   A: ${card.back}`),
    ].join('\n')
  }

  function registerTool() {
    const parameters = {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'due', 'grade', 'stats', 'list', 'update', 'merge', 'delete', 'reset_stats'],
          description:
            'add = create cards (consolidate related points into one card); due = fetch cards due for review (quiz queue); grade = record one review result; stats = learning statistics; list = search/browse cards; update = edit one card; merge = combine 2+ related cards into one (cardIds, optional front/back); delete = remove cards; reset_stats = clear review history and streak while keeping every card (only when the user explicitly asks).',
        },
        cards: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          description: 'For `add`: 1–20 cards. Each card needs a question-style front and a short back.',
          items: {
            type: 'object',
            properties: {
              front: { type: 'string', description: 'Question / prompt shown first.' },
              back: { type: 'string', description: 'Answer / explanation revealed after recall.' },
              deck: { type: 'string', description: 'Optional deck name; defaults to 默认.' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags.' },
            },
            required: ['front', 'back'],
            additionalProperties: false,
          },
        },
        cardId: { type: 'string', description: 'For `grade` / `update`: the card id.' },
        cardIds: { type: 'array', items: { type: 'string' }, description: 'For `delete` / `merge`: card ids. `merge` combines 2+ related cards into one.' },
        grade: {
          type: 'string',
          enum: ['again', 'hard', 'good', 'easy'],
          description: 'For `grade`: how well the learner recalled the card.',
        },
        deck: { type: 'string', description: 'Optional deck filter for `due` / `list`; for `merge`, the merged deck.' },
        query: { type: 'string', description: 'For `list`: search text matched against front, back, and tags.' },
        limit: { type: 'number', description: 'For `due` / `list`: max cards to return (1–50).' },
        front: { type: 'string', description: 'For `update`: new front text; for `merge`: merged front (optional).' },
        back: { type: 'string', description: 'For `update`: new back text; for `merge`: merged back (optional).' },
        tags: { type: 'array', items: { type: 'string' }, description: 'For `update` / `merge`: replacement tags.' },
      },
      required: ['action'],
      additionalProperties: false,
    }

    return ctx.tools.register({
      name: 'study',
      description:
        'Manage the learner\'s spaced-repetition deck. Use `add` to turn an explanation into a SMALL number of focused flashcards: one card per coherent concept or tightly related Q&A cluster, never one card per sentence. If a new point extends an existing card in the same deck, use `merge` (or `update`) instead of adding a near-duplicate. Use `due` to fetch the review queue and quiz the user one question at a time, `grade` to record the result (again/hard/good/easy), `stats` for progress, `list` to browse, `update`/`delete` to edit. Always prefer creating cards after teaching a topic, and never invent progress numbers.',
      parameters,
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            ok: { type: 'boolean' },
            summary: { type: 'string' },
            cardIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['ok', 'summary'],
        },
        render(_args, value) {
          const text = value && typeof value.summary === 'string' ? value.summary : ''
          return [{ type: 'text', text: text || '学习数据已更新。' }]
        },
      },
      async execute(args) {
        return serial(async () => {
          const input = isRecord(args) ? args : {}
          const action = String(input.action || '').trim()
          const now = Date.now()

          if (action === 'add') {
            const requested = Array.isArray(input.cards) ? input.cards.slice(0, 20) : []
            if (!requested.length) throw new Error('study add 需要 cards 数组（至少一张卡片）。')
            const snapshot = syncFromConfig()
            if (snapshot.cards.length + requested.length > MAX_CARDS) {
              throw new Error(`卡片数量上限为 ${MAX_CARDS} 张，请先删除一些卡片。`)
            }
            const created = []
            for (const raw of requested) {
              if (!isRecord(raw)) continue
              const front = clampText(raw.front, MAX_FRONT)
              const back = clampText(raw.back, MAX_BACK)
              if (!front || !back) continue
              created.push({
                id: newCardId(),
                front,
                back,
                deck: clampText(raw.deck, 60) || '默认',
                tags: Array.isArray(raw.tags)
                  ? raw.tags.map((tag) => clampText(tag, 40)).filter(Boolean).slice(0, 8)
                  : [],
                createdAt: now,
                due: now,
                interval: 0,
                ease: 2.5,
                reps: 0,
                lapses: 0,
                lastReview: null,
              })
            }
            if (!created.length) throw new Error('没有有效卡片：front 与 back 不能为空。')
            await persist({ ...snapshot, cards: [...snapshot.cards, ...created] })
            return {
              ok: true,
              summary: `已添加 ${created.length} 张卡片：\n${created.map((card) => `• [${card.id}] ${card.front}`).join('\n')}`,
              cardIds: created.map((card) => card.id),
            }
          }

          if (action === 'due') {
            const limit = Math.min(50, Math.max(1, Math.round(Number(input.limit) || 10)))
            const deck = clampText(input.deck, 60)
            return { ok: true, summary: dueText(limit, deck) }
          }

          if (action === 'grade') {
            const cardId = String(input.cardId || '')
            const grade = normalizeGrade(input.grade)
            if (!cardId) throw new Error('study grade 需要 cardId。')
            if (!grade) throw new Error('study grade 的 grade 必须是 again / hard / good / easy。')
            const snapshot = syncFromConfig()
            const outcome = applyReview(snapshot, cardId, grade, now)
            if (outcome.error) throw new Error(`找不到卡片 ${cardId}。`)
            await persist(outcome.state)
            return {
              ok: true,
              summary: `已记录「${grade}」：${outcome.card.front}\n下次复习：${formatDueLabel(outcome.card.due)}（间隔 ${outcome.card.interval} 天）`,
              cardIds: [cardId],
            }
          }

          if (action === 'stats') {
            return { ok: true, summary: statsText() }
          }

          if (action === 'list') {
            const snapshot = syncFromConfig()
            const deck = clampText(input.deck, 60)
            const query = clampText(input.query, 120).toLowerCase()
            const limit = Math.min(50, Math.max(1, Math.round(Number(input.limit) || 20)))
            const allMatches = snapshot.cards
              .filter((card) => !deck || card.deck === deck)
              .filter((card) => {
                if (!query) return true
                return (
                  card.front.toLowerCase().includes(query) ||
                  card.back.toLowerCase().includes(query) ||
                  card.tags.some((tag) => tag.toLowerCase().includes(query))
                )
              })
            const matches = allMatches.slice(0, limit)
            if (!matches.length) return { ok: true, summary: '没有匹配的卡片。' }
            const more = allMatches.length > matches.length ? `（仅显示前 ${matches.length} 张）` : ''
            return {
              ok: true,
              summary: [
                `共 ${snapshot.cards.length} 张卡片，匹配 ${allMatches.length} 张${more}：`,
                ...matches.map(
                  (card) =>
                    `• [${card.id}] ${card.front} — 卡组 ${card.deck}，复习 ${card.reps} 次，下次 ${formatDueLabel(card.due)}`,
                ),
              ].join('\n'),
            }
          }

          if (action === 'update') {
            const cardId = String(input.cardId || '')
            if (!cardId) throw new Error('study update 需要 cardId。')
            const snapshot = syncFromConfig()
            const card = snapshot.cards.find((item) => item.id === cardId)
            if (!card) throw new Error(`找不到卡片 ${cardId}。`)
            const updated = {
              ...card,
              front: input.front === undefined ? card.front : clampText(input.front, MAX_FRONT) || card.front,
              back: input.back === undefined ? card.back : clampText(input.back, MAX_BACK) || card.back,
              deck: input.deck === undefined ? card.deck : clampText(input.deck, 60) || card.deck,
              tags:
                input.tags === undefined
                  ? card.tags
                  : Array.isArray(input.tags)
                    ? input.tags.map((tag) => clampText(tag, 40)).filter(Boolean).slice(0, 8)
                    : card.tags,
            }
            await persist({ ...snapshot, cards: snapshot.cards.map((item) => (item.id === cardId ? updated : item)) })
            return { ok: true, summary: `已更新卡片 [${cardId}]：${updated.front}`, cardIds: [cardId] }
          }

          if (action === 'merge') {
            const ids = new Set(
              (Array.isArray(input.cardIds) ? input.cardIds : input.cardId ? [input.cardId] : [])
                .map((id) => String(id))
                .filter(Boolean),
            )
            if (ids.size < 2) throw new Error('study merge 需要至少两张卡片（cardIds）。')
            const snapshot = syncFromConfig()
            const selected = snapshot.cards.filter((card) => ids.has(card.id))
            if (selected.length < 2) throw new Error('没有找到足够的卡片可合并。')
            const first = selected[0]
            const autoFront = selected.map((card) => card.front).join('；')
            const autoBack = selected.map((card) => `• ${card.front}\n${card.back}`).join('\n\n')
            const explicitFront = input.front === undefined ? '' : clampText(input.front, MAX_FRONT)
            const explicitBack = input.back === undefined ? '' : clampText(input.back, MAX_BACK)
            const tags = input.tags === undefined
              ? [...new Set(selected.flatMap((card) => card.tags || []))].slice(0, 8)
              : Array.isArray(input.tags)
                ? input.tags.map((tag) => clampText(tag, 40)).filter(Boolean).slice(0, 8)
                : first.tags
            const merged = {
              ...first,
              front: explicitFront || clampText(autoFront, MAX_FRONT),
              back: explicitBack || clampText(autoBack, MAX_BACK),
              deck: input.deck === undefined ? first.deck : clampText(input.deck, 60) || first.deck,
              tags,
            }
            const nextCards = snapshot.cards
              .map((card) => (card.id === first.id ? merged : card))
              .filter((card) => card.id === first.id || !ids.has(card.id))
            await persist({ ...snapshot, cards: nextCards })
            return {
              ok: true,
              summary: `已把 ${selected.length} 张相关卡片合并为一张 [${first.id}]：${merged.front}`,
              cardIds: [first.id],
            }
          }

          if (action === 'reset_stats') {
            const snapshot = syncFromConfig()
            await persist({ ...snapshot, daily: {}, streak: { lastDay: '', days: 0 } })
            return { ok: true, summary: '已重置复习统计：复习历史与连续天数已清空，所有卡片保留。' }
          }

          if (action === 'delete') {
            const ids = new Set(
              (Array.isArray(input.cardIds) ? input.cardIds : input.cardId ? [input.cardId] : [])
                .map((id) => String(id))
                .filter(Boolean),
            )
            if (!ids.size) throw new Error('study delete 需要 cardId 或 cardIds。')
            const snapshot = syncFromConfig()
            const kept = snapshot.cards.filter((card) => !ids.has(card.id))
            const removed = snapshot.cards.length - kept.length
            if (!removed) throw new Error('没有找到要删除的卡片。')
            await persist({ ...snapshot, cards: kept })
            return { ok: true, summary: `已删除 ${removed} 张卡片。` }
          }

          throw new Error(`未知的 study action：${action || '(empty)'}`)
        })
      },
    })
  }

  function registerCommand() {
    return ctx.commands.register({
      name: 'study',
      description: '学习中心：查看今日复习队列、学习统计，或快速添加一张卡片',
      input: { hint: '[status|stats|due|add 正面 | 背面]' },
      handler(invocation) {
        return serial(async () => {
        const raw = String(invocation.rawInput || '').trim()
        const [verb, ...rest] = raw.split(/\s+/)
        const action = (verb || 'status').toLowerCase()
        try {
          if (action === 'stats') return { kind: 'success', text: statsText() }
          if (action === 'due') return { kind: 'success', text: dueText(10) }
          if (action === 'reset') {
            const snapshot = syncFromConfig()
            await persist({ ...snapshot, daily: {}, streak: { lastDay: '', days: 0 } })
            return { kind: 'success', text: '已重置复习统计：复习历史与连续天数已清空，所有卡片保留。' }
          }
          if (action === 'add') {
            const body = rest.join(' ')
            const separator = body.indexOf('|')
            if (separator < 0) return { kind: 'error', text: '格式：/study add 正面问题 | 背面答案' }
            const front = clampText(body.slice(0, separator), MAX_FRONT)
            const back = clampText(body.slice(separator + 1), MAX_BACK)
            if (!front || !back) return { kind: 'error', text: '正面与背面都不能为空。' }
            const snapshot = syncFromConfig()
            if (snapshot.cards.length >= MAX_CARDS) return { kind: 'error', text: `卡片数量上限为 ${MAX_CARDS} 张，请先删除一些卡片。` }
            const card = {
              id: newCardId(),
              front,
              back,
              deck: '默认',
              tags: [],
              createdAt: Date.now(),
              due: Date.now(),
              interval: 0,
              ease: 2.5,
              reps: 0,
              lapses: 0,
              lastReview: null,
            }
            await persist({ ...snapshot, cards: [...snapshot.cards, card] })
            return { kind: 'success', text: `已添加卡片 [${card.id}] ${front}` }
          }
          const stats = computeStats(syncFromConfig(), dailyGoal())
          return {
            kind: 'success',
            text: [
              `📚 今日待复习 ${stats.due} 张 · 已复习 ${stats.reviewedToday}/${stats.dailyGoal} · 连续 ${stats.streak} 天`,
              '打开左侧「学习教练」图标进入学习中心，或发送 /study due 查看队列。',
            ].join('\n'),
          }
        } catch (error) {
          return { kind: 'error', text: (error && error.message) || String(error) }
        }
        })
      },
    })
  }

  function registerYktTool() {
    const parameters = {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'login', 'logout', 'courses', 'activities', 'lesson', 'slides', 'replay', 'progress', 'mind_map', 'notes', 'score', 'analyze', 'diag'],
          description:
            'status = login state; login = save and verify a sessionid; logout = forget the session; courses =我的课程; activities = course lessons/homework timeline; lesson = lesson + presentation list; slides = courseware pages (attach=true adds page images); replay = which pages were actually shown; progress = chapter tree with deadlines; mind_map = platform mind map; notes = lecture notes; score = score composition; analyze = bundle a lesson for study-plan/exam-point analysis; diag = local plugin diagnostics (bridges/models/session).',
        },
        sessionid: { type: 'string', description: 'For `login`: the Yuketang `sessionid` cookie value. Never echo it back.' },
        cookie: { type: 'string', description: 'For `login`: a full browser Cookie header (preferred when the site needs csrftoken/university_id). Never echo it back.' },
        region: { type: 'string', enum: ykt.REGION_KEYS, description: 'Yuketang region; defaults to the saved region (standard).' },
        classroomId: { type: 'string', description: 'Course/classroom id from `courses` or `activities`.' },
        courseId: { type: 'string', description: 'Course id from `courses`, required by `progress`.' },
        lessonId: { type: 'string', description: 'Lesson id (= coursewareId of a type-14 activity), required by lesson/slides/replay/analyze.' },
        presentationId: { type: 'string', description: 'Presentation id for `slides`; omitted means the first presentation.' },
        liveId: { type: 'string', description: 'Optional lecture-note id for `notes` detail.' },
        page: { type: 'number', description: 'For `activities`: zero-based page number.' },
        size: { type: 'number', description: 'For `activities`: page size (1–200, default 50).' },
        attach: { type: 'boolean', description: 'For `slides` / `analyze`: attach slide images so the model can read them.' },
        maxSlides: { type: 'number', description: 'For `slides` / `analyze`: maximum images to attach (default 8, max 12).' },
        probe: { type: 'boolean', description: 'For `diag`: run a tiny diagnostic model call.' },
      },
      required: ['action'],
      additionalProperties: false,
    }

    function formatWhen(ms) {
      if (!ms) return '—'
      const value = ms < 1e12 ? ms * 1000 : ms
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return '—'
      const pad = (n) => (n < 10 ? '0' + n : String(n))
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function formatCourses(courses) {
      if (!courses.length) return '没有读取到课程。请确认已登录正确的雨课堂区域。'
      const byTerm = new Map()
      for (const course of courses) {
        const list = byTerm.get(course.term) || []
        list.push(course)
        byTerm.set(course.term, list)
      }
      const lines = [`雨课堂课程（共 ${courses.length} 门）：`]
      for (const term of [...byTerm.keys()].sort((a, b) => b - a)) {
        lines.push(`\n【学期 ${term}】`)
        for (const course of byTerm.get(term)) {
          lines.push(`• ${course.name}｜班级：${course.className || '—'}｜教师：${course.teacher || '—'}`)
          lines.push(`  classroomId=${course.classroomId}  courseId=${course.courseId}`)
        }
      }
      return lines.join('\n')
    }

    function formatActivities(activities) {
      if (!activities.length) return '该课程没有活动记录。'
      const typeName = (type) => (type === 5 ? '试卷作业' : type === 9 ? '公告' : type === 14 ? '上课记录' : type === 19 ? '章节作业' : `类型${type}`)
      return [
        `课程活动（共 ${activities.length} 条）：`,
        ...activities.map((activity) =>
          `• [${typeName(activity.type)}] ${formatWhen(activity.createTime)} ${activity.title || '（无标题）'}${activity.coursewareId ? `  lessonId=${activity.coursewareId}` : ''}`,
        ),
      ].join('\n')
    }

    function formatSlides(slides) {
      if (!slides.length) return '该课件没有页面。'
      return [
        `课件共 ${slides.length} 页：`,
        ...slides.map((slide) => `第 ${slide.index} 页：${slide.cover ? (/^https?:\/\//i.test(slide.cover) ? slide.cover : `https://qn-scd1.yuketang.cn/${String(slide.cover).replace(/^\/+/, '')}`) : '（无图片）'}`),
      ].join('\n')
    }

    return ctx.tools.register({
      name: 'ykt',
      description:
        'Read the user\'s own 雨课堂 (Yuketang) courses and courseware: courses, activity timeline, lesson presentations, slide pages (images can be attached for vision analysis), replay timeline, chapter progress with deadlines, mind maps, notes and score composition. Read-only — never check in, answer questions, or submit anything. Use `analyze` to gather one lesson for a study-plan and exam-point analysis.',
      parameters,
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            ok: { type: 'boolean' },
            summary: { type: 'string' },
            images: { type: 'array', items: { type: 'object' } },
          },
          required: ['ok', 'summary'],
        },
        render(_args, value) {
          const blocks = [{ type: 'text', text: (value && typeof value.summary === 'string' && value.summary) || '雨课堂数据已读取。' }]
          const images = value && Array.isArray(value.images) ? value.images : []
          for (const image of images) {
            if (image && image.attachmentId) blocks.push({ type: 'image', attachment: image })
          }
          return blocks
        },
      },
      execute(args) {
        return serial(async () => {
          const input = isRecord(args) ? args : {}
          const action = String(input.action || '').trim()
          try {
            if (action === 'status') {
              const status = await yktStatus()
              return {
                ok: true,
                summary: status.loggedIn
                  ? `已登录雨课堂：${status.account || '（未命名账号）'}｜${status.regionName}${status.school ? '｜' + status.school : ''}`
                  : '尚未登录雨课堂。请打开「学习中心 → 雨课堂」，扫码或粘贴完整 Cookie 登录（不要只贴 sessionid）。',
              }
            }

            if (action === 'diag') {
              const ws = ctx.get('webServer')
              const llm = ctx.get('llm')
              let catalog = null
              let catalogError = ''
              try { catalog = await aiModelCatalog(false) } catch (error) { catalogError = (error && error.message) || String(error) }
              let selected = null
              try { selected = aiSelection() } catch (error) { selected = { error: (error && error.message) || String(error) } }
              let sessionCount = 0
              try {
                const sessions = ctx.get('sessions')
                sessionCount = sessions && typeof sessions.list === 'function' ? sessions.list().length : 0
              } catch { /* optional */ }
              let selectedModelInfo = null
              let probe = null
              if (selected && selected.provider && selected.model && llm) {
                try {
                  selectedModelInfo = await llm.resolveModelInfo(selected.provider, selected.model)
                } catch (error) {
                  selectedModelInfo = { error: (error && error.message) || String(error) }
                }
                if (input.probe === true) {
                  try {
                    const result = await ai.streamText(llm, selected, {
                      system: 'Reply with exactly: pong',
                      messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
                      maxTokens: 512,
                      temperature: 0,
                      sessionId: aiSessionId(),
                    })
                    probe = { ok: true, text: result.text }
                  } catch (error) {
                    probe = { ok: false, code: error && error.code, message: (error && error.message) || String(error) }
                  }
                }
              }
              if (input.lessonId) {
                const lessonId = String(input.lessonId)
                const key = `diag:${lessonId}:${Date.now()}`
                const job = {
                  key,
                  scopeKey: yktScopeKey(),
                  lessonId,
                  status: 'queued',
                  phase: 'prepare',
                  message: 'diagnostic',
                  progress: 0,
                  totalSlides: 0,
                  readSlides: 0,
                  maxSlides: Number(input.maxSlides) || 0,
                  title: '',
                  courseName: '',
                  model: null,
                  error: '',
                  result: null,
                  cached: false,
                  startedAt: Date.now(),
                  updatedAt: Date.now(),
                  controller: new AbortController(),
                }
                summaryJobs.set(key, job)
                await runSummaryJob(job, { lessonId })
                summaryJobs.delete(key)
                return {
                  ok: true,
                  summary: JSON.stringify({
                    lessonId,
                    status: job.status,
                    error: job.error || '',
                    warnings: job.warnings || [],
                    title: job.title,
                    totalSlides: job.totalSlides,
                    readSlides: job.readSlides,
                    result: job.result ? { title: job.result.title, knowledgePoints: (job.result.knowledgePoints || []).length, examPoints: (job.result.examPoints || []).length, raw: job.result.raw === true } : null,
                  }, null, 2),
                }
              }
              return {
                ok: true,
                summary: JSON.stringify({
                  webServer: !!ws && typeof ws.register === 'function',
                  routesRegistered: registeredRouteCount,
                  llm: !!llm,
                  attachments: !!ctx.get('attachments'),
                  modelProviders: catalog ? catalog.providers.map((provider) => ({ id: provider.id, models: provider.models.length })) : [],
                  modelError: catalogError || (catalog && catalog.error) || '',
                  selected,
                  selectedModelInfo,
                  probe,
                  sessionCount,
                  scope: yktScopeKey(),
                }, null, 2),
              }
            }

            if (action === 'login') {
              const region = ykt.isRegion(input.region) ? input.region : yktRegion()
              const credential = String(input.cookie || input.sessionid || '')
              const client = new ykt.YktClient(region, credential)
              const profile = await client.verify()
              await saveYktLogin(client.cookie, region, profile)
              return {
                ok: true,
                summary: `已登录雨课堂：${profile.name || '（未命名账号）'}${profile.school ? '｜' + profile.school : ''}｜${ykt.REGION_NAMES[region]}`,
              }
            }

            if (action === 'logout') {
              await clearYktLogin()
              return { ok: true, summary: '已清除本机保存的雨课堂会话。' }
            }

            if (action === 'courses') {
              const courses = await ykt.listCourses(await yktClient())
              return { ok: true, summary: formatCourses(courses) }
            }

            if (action === 'activities') {
              const classroomId = String(input.classroomId || '')
              if (!classroomId) throw new ykt.YktError('activities 需要 classroomId')
              const result = await ykt.listActivities(await yktClient(), classroomId, { page: input.page, size: input.size })
              return { ok: true, summary: formatActivities(result.activities) + (result.complete ? '' : '\n（还有更多活动，可用 page 继续读取）') }
            }

            if (action === 'lesson') {
              const lessonId = String(input.lessonId || '')
              if (!lessonId) throw new ykt.YktError('lesson 需要 lessonId')
              const client = await yktClient()
              const [info, summary] = await Promise.all([ykt.getLessonInfo(client, lessonId), ykt.getLessonSummary(client, lessonId)])
              const presentationIds = [...new Set([...info.presentationIds, ...summary.presentations.map((item) => item.id)])]
              return {
                ok: true,
                summary: [
                  `课时：${info.lessonName || summary.lessonTitle || lessonId}`,
                  `课程：${info.courseName || '—'}｜班级：${info.classroomName || '—'}｜教师：${info.teacherName || '—'}`,
                  `activityId：${info.activityId || '—'}`,
                  `课件（${summary.presentations.length} 份）：`,
                  ...summary.presentations.map((item) => `• ${item.title || '（无标题）'}  presentationId=${item.id}  页数=${item.slidesCount || '—'}`),
                  presentationIds.length && !summary.presentations.length ? `presentationIds：${presentationIds.join(', ')}` : '',
                ].filter(Boolean).join('\n'),
              }
            }

            if (action === 'slides') {
              const lessonId = String(input.lessonId || '')
              if (!lessonId) throw new ykt.YktError('slides 需要 lessonId')
              const client = await yktClient()
              let presentationId = String(input.presentationId || '')
              if (!presentationId) {
                const summary = await ykt.getLessonSummary(client, lessonId)
                presentationId = summary.presentations[0] && summary.presentations[0].id
              }
              if (!presentationId) {
                const info = await ykt.getLessonInfo(client, lessonId)
                presentationId = info.presentationIds[0] || ''
              }
              if (!presentationId) throw new ykt.YktError('找不到该课时的课件，请先调用 lesson 查看 presentationId。')
              const slides = await ykt.listSlides(client, presentationId, lessonId)
              const summaryText = formatSlides(slides)
              if (!input.attach) return { ok: true, summary: summaryText }
              const attached = await downloadSlideImages(slides, input.maxSlides)
              return {
                ok: true,
                summary: summaryText + (attached.images.length ? `\n\n已附带前 ${attached.images.length} 页图片，请逐页阅读。` : '') + (attached.note || ''),
                images: attached.images,
              }
            }

            if (action === 'replay') {
              const lessonId = String(input.lessonId || '')
              if (!lessonId) throw new ykt.YktError('replay 需要 lessonId')
              const timeline = await ykt.getReplayTimeline(await yktClient(), lessonId)
              return {
                ok: true,
                summary: [
                  `回放时长：${Math.round(timeline.durationMs / 60000)} 分钟`,
                  `实际讲过的页：${timeline.shownSlideIndexes.length ? timeline.shownSlideIndexes.join(', ') : '没有回放记录'}`,
                  `事件数：${timeline.events.length}`,
                ].join('\n'),
              }
            }

            if (action === 'progress') {
              const classroomId = String(input.classroomId || '')
              const courseId = String(input.courseId || '')
              if (!classroomId || !courseId) throw new ykt.YktError('progress 需要 classroomId 与 courseId')
              const result = await ykt.getCourseProgress(await yktClient(), classroomId, courseId)
              const leaves = result.leaves
              if (!leaves.length) return { ok: true, summary: '该课程没有读取到章节进度。' }
              const typeName = (type) => (type === 0 ? '视频' : type === 3 ? '推荐' : type === 4 ? '讨论' : type === 5 ? '考试/作业' : type === 6 ? '作业' : type === 8 ? '签到/课堂' : type === 19 ? '章节作业' : `类型${type}`)
              return {
                ok: true,
                summary: [
                  `课程章节（共 ${leaves.length} 项）：`,
                  ...leaves.map((leaf) => {
                    const score = leaf.userScore !== undefined ? `${leaf.userScore}/${leaf.totalScore ?? '—'}` : '—'
                    return `• [${typeName(leaf.leafType)}] ${leaf.name}｜${leaf.status || '—'}｜完成 ${leaf.done ?? '—'}/${leaf.total ?? '—'}｜得分 ${score}｜截止 ${leaf.scoreDeadline ? formatWhen(leaf.scoreDeadline) : '—'}${leaf.locked ? '｜🔒锁定' : ''}`
                  }),
                ].join('\n'),
              }
            }

            if (action === 'mind_map') {
              const lessonId = String(input.lessonId || '')
              if (!lessonId) throw new ykt.YktError('mind_map 需要 lessonId')
              const map = await ykt.getMindMap(await yktClient(), lessonId)
              return { ok: true, summary: map ? '课堂思维导图：\n' + JSON.stringify(map, null, 2).slice(0, 18000) : '该课时没有生成思维导图。' }
            }

            if (action === 'notes') {
              const lessonId = String(input.lessonId || '')
              if (!lessonId) throw new ykt.YktError('notes 需要 lessonId')
              const client = await yktClient()
              if (input.liveId) {
                const notes = await ykt.getLectureNoteDetail(client, lessonId, String(input.liveId))
                return { ok: true, summary: `笔记正文（${notes.length} 条）：\n` + JSON.stringify(notes, null, 2).slice(0, 18000) }
              }
              const notes = await ykt.listLectureNotes(client, lessonId)
              return { ok: true, summary: `课堂笔记：${notes.notes.length} 份${notes.visible ? '' : '（学生端不可见）'}\n` + notes.notes.map((note) => `• liveId=${note.liveId} 时长=${Math.round(note.durationMs / 60000)} 分钟`).join('\n') }
            }

            if (action === 'score') {
              const lessonId = String(input.lessonId || '')
              if (!lessonId) throw new ykt.YktError('score 需要 lessonId')
              const score = await ykt.getScoreDetail(await yktClient(), lessonId)
              return { ok: true, summary: `本课得分：${score.studentScore}\n` + score.parts.map((part) => `• ${part.name}：${part.percent}%`).join('\n') }
            }

            if (action === 'analyze') {
              const lessonId = String(input.lessonId || '')
              if (!lessonId) throw new ykt.YktError('analyze 需要 lessonId')
              const client = await yktClient()
              const [info, summary] = await Promise.all([ykt.getLessonInfo(client, lessonId), ykt.getLessonSummary(client, lessonId)])
              const presentations = summary.presentations.length
                ? summary.presentations
                : [...new Set(info.presentationIds)].map((id) => ({ id, title: info.lessonName || '课件', slidesCount: 0 }))
              const slideGroups = []
              for (const presentation of presentations) {
                try {
                  const slides = await ykt.listSlides(client, presentation.id, lessonId)
                  slideGroups.push({ presentation, slides })
                } catch (error) {
                  slideGroups.push({ presentation, slides: [], error: (error && error.message) || String(error) })
                }
              }
              let replay = null
              try { replay = await ykt.getReplayTimeline(client, lessonId) } catch { /* optional */ }
              let mindMap = null
              try { mindMap = await ykt.getMindMap(client, lessonId) } catch { /* optional */ }
              let progress = null
              if (input.classroomId && input.courseId) {
                try { progress = await ykt.getCourseProgress(client, String(input.classroomId), String(input.courseId)) } catch { /* optional */ }
              }
              const allSlides = slideGroups.flatMap((group) => group.slides)
              const attached = input.attach === false ? { images: [], note: '' } : await downloadSlideImages(allSlides, input.maxSlides)
              const lines = [
                `课程：${info.courseName || '—'}｜班级：${info.classroomName || '—'}｜教师：${info.teacherName || '—'}`,
                `课时：${info.lessonName || summary.lessonTitle || lessonId}`,
                `课件：${presentations.map((p) => `${p.title || '（无标题）'}(${p.slidesCount || '—'}页)`).join('、') || '—'}`,
                replay ? `回放实际讲过的页：${replay.shownSlideIndexes.join(', ') || '无记录'}（${Math.round(replay.durationMs / 60000)} 分钟）` : '',
                mindMap ? `思维导图：\n${JSON.stringify(mindMap, null, 2).slice(0, 8000)}` : '思维导图：无',
                progress ? `课程进度：共 ${progress.leaves.length} 项，最近截止 ${progress.leaves.filter((l) => l.scoreDeadline).sort((a, b) => a.scoreDeadline - b.scoreDeadline).slice(0, 3).map((l) => `${l.name}@${formatWhen(l.scoreDeadline)}`).join('、') || '—'}` : '',
                `课件页图片：共 ${allSlides.length} 页${attached.images.length ? `，已附带前 ${attached.images.length} 页` : ''}。${attached.note || ''}`,
                attached.images.length ? '请阅读随附的课件图片，输出：1) 学习计划（按日期/优先级）；2) 考点清单（按重要度）；3) 用 study 工具把考点做成原子化复习卡片。' : '课件图片未随附（请用 slides 动作或上面的图片链接查看），输出：1) 学习计划；2) 考点清单；3) 用 study 工具把考点做成复习卡片。',
              ].filter(Boolean)
              return { ok: true, summary: lines.join('\n'), images: attached.images }
            }

            throw new ykt.YktError(`未知的 ykt action：${action || '(empty)'}`)
          } catch (error) {
            if (error && error.name === 'YktError') return { ok: false, summary: yktErrorSummary(error) }
            throw error
          }
        })
      },
    })
  }

  function registerYktRoutes(webServerOverride) {
    const webServer = webServerOverride || ctx.get('webServer')
    if (!webServer || typeof webServer.register !== 'function') return undefined
    const prefix = '/api/local/dsh-ykt-study'
    const header = (request, name) => {
      const value = request.headers ? request.headers[name] : undefined
      return Array.isArray(value) ? value[0] : value
    }
    const isLoopback = (value) => {
      const address = String(value || '').toLowerCase().replace(/^\[|\]$/g, '')
      return address === 'localhost' || address === 'localhost.' || address === '::1' || address.startsWith('127.') || address.startsWith('::ffff:127.')
    }
    const isTrusted = (request) => {
      if (header(request, 'x-dsh-ykt-bridge') !== '1') return false
      if (!isLoopback(request.socket && request.socket.remoteAddress)) return false
      const site = header(request, 'sec-fetch-site')
      if (site !== undefined && site !== 'same-origin') return false
      const host = header(request, 'host')
      if (!host) return false
      const origin = header(request, 'origin')
      if (!origin) {
        try {
          return isLoopback(new URL(`http://${host}`).hostname)
        } catch {
          return false
        }
      }
      try {
        const parsed = new URL(origin)
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && isLoopback(parsed.hostname) && parsed.host === host
      } catch {
        return false
      }
    }
    const sendJson = (response, status, body) => {
      const text = JSON.stringify(body)
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      response.end(text)
    }
    const readJson = async (request) => {
      let total = 0
      const chunks = []
      for await (const chunk of request) {
        total += chunk.length
        if (total > 8 * 1024 * 1024) throw new ykt.YktError('请求体过大')
        chunks.push(chunk)
      }
      if (!chunks.length) return {}
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ykt.YktError('请求体不是 JSON') }
    }
    const route = async (request, response, path) => {
      if (!isTrusted(request)) return sendJson(response, 403, { ok: false, error: { message: '拒绝非本机同源请求' } })
      const url = new URL(request.url || '/', 'http://localhost')
      try {
        if (path === 'status' && request.method === 'GET') {
          return sendJson(response, 200, { ok: true, data: await yktStatus() })
        }
        if (path === 'qr' && request.method === 'POST') {
          const body = await readJson(request)
          const region = ykt.isRegion(body.region) ? body.region : 'standard'
          const ticket = await ykt.requestLoginQr(region)
          const now = Date.now()
          for (const [token, entry] of qrTickets) {
            if (now - entry.issuedAt > 10 * 60 * 1000) qrTickets.delete(token)
          }
          qrTickets.set(ticket.token, { region, issuedAt: ticket.issuedAt })
          return sendJson(response, 200, { ok: true, data: { token: ticket.token, qrContent: ticket.qrContent, expiresAt: ticket.expiresAt } })
        }
        if (path === 'qr/poll' && request.method === 'POST') {
          const body = await readJson(request)
          const token = String(body.token || '')
          const ticket = qrTickets.get(token)
          if (!ticket) throw new ykt.YktError('二维码已失效，请重新获取')
          const result = await ykt.pollLogin(ticket.region, token, { timeoutMs: 10_000 })
          if (result.status === 'success') {
            const client = new ykt.YktClient(ticket.region, result.cookie || result.sessionid)
            let profile = { name: result.name, school: '', userId: result.userId }
            try {
              const verified = await client.verify()
              profile = { name: verified.name || result.name, school: verified.school || '', userId: verified.userId || result.userId }
            } catch { /* keep the name returned by login */ }
            await saveYktLogin(client.cookie || result.cookie || result.sessionid, ticket.region, profile)
            qrTickets.delete(token)
            return sendJson(response, 200, { ok: true, data: { status: 'success', login: await yktStatus() } })
          }
          if (result.status === 'expired') qrTickets.delete(token)
          return sendJson(response, 200, { ok: true, data: result })
        }
        if (path === 'login' && request.method === 'POST') {
          const body = await readJson(request)
          const region = ykt.isRegion(body.region) ? body.region : 'standard'
          const credential = String(body.cookie || body.sessionid || '')
          const client = new ykt.YktClient(region, credential)
          const profile = await client.verify()
          await saveYktLogin(client.cookie, region, profile)
          return sendJson(response, 200, { ok: true, data: await yktStatus() })
        }
        if (path === 'logout' && request.method === 'POST') {
          await clearYktLogin()
          return sendJson(response, 200, { ok: true, data: await yktStatus() })
        }
        if (path === 'courses' && request.method === 'GET') {
          const courses = await ykt.listCourses(await yktClient())
          return sendJson(response, 200, { ok: true, data: { courses } })
        }
        if (path === 'activities' && request.method === 'GET') {
          const classroomId = url.searchParams.get('classroomId') || ''
          if (!classroomId) throw new ykt.YktError('缺少 classroomId')
          const result = await ykt.listActivities(await yktClient(), classroomId, { page: Number(url.searchParams.get('page')) || 0, size: Number(url.searchParams.get('size')) || 50 })
          return sendJson(response, 200, { ok: true, data: result })
        }
        if (path === 'lesson' && request.method === 'GET') {
          const lessonId = url.searchParams.get('lessonId') || ''
          if (!lessonId) throw new ykt.YktError('缺少 lessonId')
          const client = await yktClient()
          const [info, summary] = await Promise.all([ykt.getLessonInfo(client, lessonId), ykt.getLessonSummary(client, lessonId)])
          return sendJson(response, 200, { ok: true, data: { info, summary } })
        }
        if (path === 'slides' && request.method === 'GET') {
          const lessonId = url.searchParams.get('lessonId') || ''
          const presentationId = url.searchParams.get('presentationId') || ''
          if (!lessonId || !presentationId) throw new ykt.YktError('缺少 lessonId 或 presentationId')
          const slides = await ykt.listSlides(await yktClient(), presentationId, lessonId)
          return sendJson(response, 200, { ok: true, data: { slides } })
        }
        if (path === 'progress' && request.method === 'GET') {
          const classroomId = url.searchParams.get('classroomId') || ''
          const courseId = url.searchParams.get('courseId') || ''
          if (!classroomId || !courseId) throw new ykt.YktError('缺少 classroomId 或 courseId')
          const progress = await ykt.getCourseProgress(await yktClient(), classroomId, courseId)
          return sendJson(response, 200, { ok: true, data: progress })
        }
        if (path === 'mindmap' && request.method === 'GET') {
          const lessonId = url.searchParams.get('lessonId') || ''
          if (!lessonId) throw new ykt.YktError('缺少 lessonId')
          const mindMap = await ykt.getMindMap(await yktClient(), lessonId)
          return sendJson(response, 200, { ok: true, data: { mindMap } })
        }
        if (path === 'models' && request.method === 'GET') {
          const catalog = await aiModelCatalog(false)
          let effective = null
          let error = catalog.error || ''
          try {
            effective = aiSelection()
          } catch (cause) {
            error = error || ((cause && cause.message) || String(cause))
          }
          return sendJson(response, 200, {
            ok: true,
            data: {
              providers: catalog.providers || [],
              error,
              override: aiOverride(),
              effective,
            },
          })
        }
        if (path === 'model' && request.method === 'POST') {
          const body = await readJson(request)
          const saved = await saveAiSelection(body)
          modelCatalogCache.at = 0
          return sendJson(response, 200, { ok: true, data: saved })
        }
        if (path === 'summary/start' && request.method === 'POST') {
          const body = await readJson(request)
          const lessonId = String(body.lessonId || '')
          if (!lessonId) throw new ykt.YktError('缺少 lessonId')
          if (!(await readYktSession())) throw new ykt.YktError('请先登录雨课堂')
          if (body.force !== true) {
            const cached = await getCachedSummary(lessonId)
            if (cached && cached.summary) {
              return sendJson(response, 200, {
                ok: true,
                data: {
                  job: {
                    lessonId,
                    status: 'done',
                    phase: 'done',
                    message: '已读取上次的总结',
                    progress: 1,
                    totalSlides: cached.summary.meta ? cached.summary.meta.slideCount : 0,
                    readSlides: cached.summary.meta ? cached.summary.meta.slideCount : 0,
                    title: cached.summary.meta ? cached.summary.meta.title : '',
                    courseName: cached.summary.meta ? cached.summary.meta.courseName : '',
                    model: cached.summary.meta ? cached.summary.meta.model : null,
                    error: '',
                    result: cached.summary,
                    cached: true,
                    startedAt: cached.updatedAt,
                    updatedAt: cached.updatedAt,
                  },
                },
              })
            }
          }
          const job = startSummaryJob({ lessonId, exclude: body.exclude })
          return sendJson(response, 200, { ok: true, data: { job } })
        }
        if (path === 'summary/status' && request.method === 'GET') {
          const lessonId = url.searchParams.get('lessonId') || ''
          if (!lessonId) throw new ykt.YktError('缺少 lessonId')
          if (!(await readYktSession())) throw new ykt.YktError('请先登录雨课堂')
          const job = summaryJobs.get(scopedLessonKey(lessonId))
          if (job) return sendJson(response, 200, { ok: true, data: { job: publicJob(job) } })
          const cached = await getCachedSummary(lessonId)
          if (cached && cached.summary) {
            return sendJson(response, 200, {
              ok: true,
              data: {
                job: {
                  lessonId,
                  status: 'done',
                  phase: 'done',
                  message: '已读取上次的总结',
                  progress: 1,
                  totalSlides: cached.summary.meta ? cached.summary.meta.slideCount : 0,
                  readSlides: cached.summary.meta ? cached.summary.meta.slideCount : 0,
                  title: cached.summary.meta ? cached.summary.meta.title : '',
                  courseName: cached.summary.meta ? cached.summary.meta.courseName : '',
                  model: cached.summary.meta ? cached.summary.meta.model : null,
                  error: '',
                  result: cached.summary,
                  cached: true,
                  startedAt: cached.updatedAt,
                  updatedAt: cached.updatedAt,
                },
              },
            })
          }
          return sendJson(response, 200, { ok: true, data: { job: null } })
        }
        if (path === 'summary/cancel' && request.method === 'POST') {
          const body = await readJson(request)
          const lessonId = String(body.lessonId || '')
          if (!(await readYktSession())) throw new ykt.YktError('请先登录雨课堂')
          const job = summaryJobs.get(scopedLessonKey(lessonId))
          if (job && job.controller && (job.status === 'queued' || job.status === 'running')) {
            job.controller.abort()
            updateJob(job, { status: 'cancelled', phase: 'cancelled', message: '已取消' })
          }
          return sendJson(response, 200, { ok: true, data: { job: job ? publicJob(job) : null } })
        }
        if (path === 'summary/cards' && request.method === 'POST') {
          const body = await readJson(request)
          const lessonId = String(body.lessonId || '')
          if (!lessonId) throw new ykt.YktError('缺少 lessonId')
          if (!(await readYktSession())) throw new ykt.YktError('请先登录雨课堂')
          const result = await createSummaryCards(lessonId)
          return sendJson(response, 200, { ok: true, data: result })
        }
        if (path === 'chats/load' && request.method === 'POST') {
          const body = await readJson(request)
          const lessonId = String(body.lessonId || '')
          if (!lessonId) throw new ykt.YktError('缺少 lessonId')
          return sendJson(response, 200, { ok: true, data: await loadLessonChats(lessonId) })
        }
        if (path === 'chats/save' && request.method === 'POST') {
          const body = await readJson(request)
          const lessonId = String(body.lessonId || '')
          if (!lessonId) throw new ykt.YktError('缺少 lessonId')
          await saveLessonChat(lessonId, String(body.kind || ''), body.key, body.messages)
          return sendJson(response, 200, { ok: true, data: { saved: true } })
        }
        if (path === 'chats/clear' && request.method === 'POST') {
          const body = await readJson(request)
          await clearChats(String(body.lessonId || ''))
          return sendJson(response, 200, { ok: true, data: { cleared: true } })
        }
        if (path === 'slide-image' && request.method === 'POST') {
          const body = await readJson(request)
          const result = await slideImageDataUrl(body)
          return sendJson(response, 200, { ok: true, data: result })
        }
        if (path === 'page-chat' && request.method === 'POST') {
          const body = await readJson(request)
          const result = await pageChatAnswer(body)
          return sendJson(response, 200, { ok: true, data: result })
        }
        if (path === 'board-chat' && request.method === 'POST') {
          const body = await readJson(request)
          const result = await boardChatAnswer(body)
          return sendJson(response, 200, { ok: true, data: result })
        }
        return sendJson(response, 404, { ok: false, error: { message: '未知的雨课堂接口' } })
      } catch (error) {
        return sendJson(response, 200, {
          ok: false,
          error: { message: (error && error.message) || String(error), code: error && error.code, nextAction: error && error.nextAction },
        })
      }
    }
    const routes = ['status', 'qr', 'qr/poll', 'login', 'logout', 'courses', 'activities', 'lesson', 'slides', 'progress', 'mindmap', 'models', 'model', 'summary/start', 'summary/status', 'summary/cancel', 'summary/cards', 'slide-image', 'page-chat', 'board-chat', 'chats/load', 'chats/save', 'chats/clear']
    registeredRouteCount = routes.length
    const disposers = routes.map((name) => webServer.register({
      kind: 'exact',
      path: `${prefix}/${name}`,
      handler: (request, response) => route(request, response, name),
    }))
    return () => {
      registeredRouteCount = 0
      disposers.forEach((dispose) => dispose())
    }
  }

  function registerPrompt() {
    const disposers = []
    disposers.push(ctx.systemPrompt.section({ name: 'study-coach', order: 700, text: STUDY_SECTION }))
    disposers.push(
      ctx.systemPrompt.context({
        name: 'study-progress',
        order: 300,
        text: () => {
          const snapshot = syncFromConfig()
          if (!snapshot.cards.length) return ''
          const stats = computeStats(snapshot, dailyGoal())
          return `Learning deck: ${stats.total} cards, ${stats.due} due for review, ${stats.reviewedToday}/${stats.dailyGoal} reviewed today, ${stats.streak}-day streak. Use the study tool when the user wants to learn, be quizzed, or review progress.`
        },
      }),
    )
    return () => disposers.forEach((dispose) => dispose())
  }

  ctx.effect(() => {
    try {
      return settings.configure({ auto: false }, ctx.fiber)
    } catch {
      return undefined
    }
  })

  // If the row was inserted with an empty config, the schema default seeds the
  // deck in memory; write that snapshot once so the Web panel can read it.
  ctx.effect(() => {
    if (vget(config.stateJson, '')) return undefined
    const timer = setTimeout(() => {
      persist(state).catch(() => {})
    }, 1200)
    return () => clearTimeout(timer)
  })

  ctx.effect(registerTool)
  ctx.effect(registerYktTool)
  ctx.effect(registerCommand)
  ctx.effect(registerPrompt)
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (child) => {
      child.effect(() => registerYktRoutes(child.webServer || (typeof child.get === 'function' ? child.get('webServer') : undefined)))
    })
  } else {
    ctx.effect(() => registerYktRoutes())
  }
  ctx.effect(() => () => {
    for (const job of summaryJobs.values()) {
      try {
        job.controller.abort()
      } catch {
        /* already disposed */
      }
    }
  })
}
