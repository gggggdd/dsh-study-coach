/**
 * AI helpers for the Learning Coach plugin.
 *
 * This module is deliberately free of Cordis/Host dependencies so it can be
 * unit-tested with a tiny fake `llm` service. It owns:
 *  - model selection normalisation
 *  - one streaming text call (`llm.prepareCall` + `prepared.stream`)
 *  - prompts for whole-lesson slide reading, final summary composition and
 *    per-slide Q&A
 *  - tolerant parsing/normalisation of the model's JSON summary
 *  - Markdown rendering and flashcard conversion
 *  - annotation descriptions shared by the page-chat prompt
 */

export class AiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'AiError'
    this.code = options.code
    this.status = options.status
    this.nextAction = options.nextAction
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value, max = 4000) {
  const raw = typeof value === 'string' ? value : value == null ? '' : String(value)
  const trimmed = raw.trim()
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function oneOf(value, allowed, fallback) {
  const raw = String(value == null ? '' : value).toLowerCase()
  if (allowed.indexOf(raw) >= 0) return raw
  if (raw === '高' || raw === '重要' || raw === '重点' || raw === 'high') return allowed.indexOf('high') >= 0 ? 'high' : fallback
  if (raw === '中' || raw === '一般' || raw === '掌握' || raw === 'medium') return allowed.indexOf('medium') >= 0 ? 'medium' : fallback
  if (raw === '低' || raw === '了解' || raw === 'low') return allowed.indexOf('low') >= 0 ? 'low' : fallback
  return fallback
}

/** Accept the shapes returned by agentDefaultModel.currentSelection() and plugin config. */
export function normalizeSelection(value) {
  if (!isRecord(value)) return null
  const provider = text(value.provider, 120)
  const model = text(value.model, 200)
  if (!provider || !model) return null
  const selection = { provider, model }
  const effort = text(value.reasoningEffort, 40)
  if (effort) selection.reasoningEffort = effort
  return selection
}

/**
 * Pick a reasoning effort the exact model actually supports.
 *
 * `want: 'least'` returns the model's first (cheapest) effort — the same rule
 * DSH's own auxiliary calls use. Any other string returns that effort when the
 * model lists it, else the model's default (undefined). Models without a
 * reasoning catalog always get undefined, because sending an effort to them
 * fails with UNSUPPORTED_REASONING_EFFORT.
 */
export function pickReasoningEffort(info, want) {
  const reasoning = isRecord(info) && isRecord(info.reasoning) ? info.reasoning : null
  const efforts = reasoning ? list(reasoning.efforts).map((effort) => (isRecord(effort) ? text(effort.id, 40) : '')).filter(Boolean) : []
  if (!efforts.length) return undefined
  if (want === 'least') return efforts[0]
  const wanted = text(want, 40)
  return wanted && efforts.indexOf(wanted) >= 0 ? wanted : undefined
}

/** True for provider failures that mean "slow down", not "this request is wrong". */
export function isRateLimitError(error) {
  if (!error) return false
  const code = String(error.code || '').toUpperCase()
  return code === 'RATE_LIMIT' || code === 'RATE_LIMITED' || Number(error.status) === 429
}

/**
 * Stream one model answer and collect its text.
 *
 * @param {object} llm Host `llm` service.
 * @param {{provider:string,model:string,reasoningEffort?:string}} selection
 * @param {{messages:Array, system?:string, maxTokens?:number, temperature?:number,
 *          signal?:AbortSignal, requireImage?:boolean}} options
 * @returns {Promise<{text:string, usage?:object}>}
 */
export async function streamText(llm, selection, options = {}) {
  if (!llm || typeof llm.stream !== 'function') {
    throw new AiError('当前宿主没有可用的 AI 模型服务，请确认 Harness 已配置模型。', {
      code: 'NO_LLM',
      nextAction: 'configure-model',
    })
  }
  if (options.requireImage && (options.modelInfo || typeof llm.resolveModelInfo === 'function')) {
    let info = options.modelInfo
    try {
      if (!info) info = await llm.resolveModelInfo(selection.provider, selection.model, options.signal)
    } catch (error) {
      throw new AiError(`模型信息读取失败：${(error && error.message) || String(error)}`, {
        code: (error && error.code) || 'MODEL_INFO_FAILED',
        status: error && error.status,
      })
    }
    const modalities = info && info.inputModalities
    if (Array.isArray(modalities) && modalities.indexOf('image') < 0) {
      throw new AiError('当前模型不支持图片输入。请在雨课堂面板的「模型」中改用支持图片的模型（例如 DeepSeek-V4.1-Flash）。', {
        code: 'NO_VISION',
        nextAction: 'choose-vision-model',
      })
    }
  }

  const request = {
    provider: selection.provider,
    model: selection.model,
    messages: Array.isArray(options.messages) ? options.messages : [],
  }
  if (selection.reasoningEffort) request.reasoningEffort = selection.reasoningEffort
  if (options.system) request.system = options.system
  if (options.maxTokens) request.maxTokens = options.maxTokens
  if (options.temperature !== undefined) request.temperature = options.temperature
  if (options.signal) request.signal = options.signal
  if (options.sessionId) request.sessionId = options.sessionId

  let answer = ''
  let reasoning = ''
  let usage
  const onText = typeof options.onText === 'function' ? options.onText : null
  try {
    for await (const chunk of llm.stream(request)) {
      if (!chunk || typeof chunk !== 'object') continue
      if (chunk.type === 'text-delta') {
        answer += chunk.text || ''
        if (onText && chunk.text) onText(chunk.text)
      }
      else if (chunk.type === 'reasoning-delta') reasoning += chunk.text || ''
      else if (chunk.type === 'usage') usage = chunk.usage
      else if (chunk.type === 'finish') {
        const reason = chunk.reason || {}
        if (reason.kind === 'error') {
          const failure = reason.failure || {}
          throw new AiError(failure.message || '模型调用失败', {
            code: failure.code || 'LLM_ERROR',
            status: failure.status,
          })
        }
        if (reason.kind === 'aborted') {
          throw new AiError('模型调用已取消', { code: 'ABORTED' })
        }
      }
    }
  } catch (error) {
    if (error instanceof AiError) throw error
    throw new AiError(`模型调用失败：${(error && error.message) || String(error)}`, {
      code: (error && error.code) || 'LLM_ERROR',
      status: error && error.status,
    })
  }
  if (!answer.trim() && reasoning.trim()) answer = reasoning
  if (!answer.trim()) throw new AiError('模型没有返回内容，请重试或更换模型。', { code: 'EMPTY_ANSWER' })
  return { text: answer.trim(), usage }
}

export const SUMMARY_SYSTEM =
  '你是一位严谨的大学课程助教，擅长把雨课堂课件整理成期末复习资料。你只依据用户提供的课件内容作答，不编造页面中不存在的知识、数字或结论；看不清的内容会明确说明。'

export function buildSlideNotesPrompt(options = {}) {
  const course = text(options.courseName, 120) || '未知课程'
  const lesson = text(options.lessonTitle, 160) || '当前课时'
  const presentation = text(options.presentationTitle, 160)
  const from = Math.max(1, Number(options.from) || 1)
  const to = Math.max(from, Number(options.to) || from)
  const total = Math.max(to, Number(options.total) || to)
  const lines = [
    `你正在阅读雨课堂课件《${lesson}》（课程：${course}）${presentation ? '，课件：' + presentation : ''}。`,
    `下面是本课件第 ${from}–${to} 页图片（本课件共 ${total} 页）。请逐页精读，并输出「逐页笔记」。`,
    '',
    '输出格式：',
    '第 N 页：',
    '- 主题：……',
    '- 知识点：逐条列出定义、公式、定理、步骤、结论、例题与答案要点；',
    '- 考点/易错点：页面中老师标注、强调或明显适合出题的内容；',
    '- 页面细节：图表、代码、标注、例题条件等不能遗漏。',
    '',
    '要求：',
    '1. 必须覆盖这一批里的每一页，即使某页只有标题也写出来；',
    '2. 不要概括性省略，不要合并多页；',
    '3. 看不清的文字写“不清晰”，绝不编造；',
    '4. 直接输出笔记，不要寒暄，不要复述这些要求。',
  ]
  return lines.join('\n')
}

export function buildSummaryPrompt(options = {}) {
  const course = text(options.courseName, 120) || '未知课程'
  const lesson = text(options.lessonTitle, 160) || '当前课时'
  const notes = text(options.notes, 160000)
  const total = Math.max(0, Number(options.totalSlides) || 0)
  const replay = list(options.replayPages).slice(0, 200)
  const mindMap = text(options.mindMapText, 12000)
  const lectureNotes = text(options.lectureNoteText, 16000)
  const lines = [
    `课程：${course}`,
    `课时：${lesson}`,
    `课件总页数：${total}`,
  ]
  if (replay.length) lines.push(`老师实际讲过的页：${replay.join('、')}（这些页更重要，可加权）`)
  if (mindMap) lines.push(`平台思维导图：\n${mindMap}`)
  if (lectureNotes) lines.push(`课堂笔记：\n${lectureNotes}`)
  lines.push(
    '',
    '以下是这套课件的逐页笔记（按页序）：',
    notes,
    '',
    '请把全部逐页笔记整合成一份用于期末复习的知识点总结，并严格输出一个 JSON 对象（不要 Markdown 代码块、不要任何解释文字）：',
    '{',
    '  "title": "课时标题",',
    '  "overview": "2–4 句话概括本课主线与学习目标",',
    '  "knowledgePoints": [',
    '    { "name": "知识点名称", "detail": "完整解释（定义/公式/推导/步骤/例子要点）", "importance": "high|medium|low", "page": 12 }',
    '  ],',
    '  "examPoints": [',
    '    { "name": "考点名称", "why": "为什么重要、常见题型", "how": "答题思路或关键步骤" }',
    '  ],',
    '  "pitfalls": ["易错点/易混点，逐条说明怎么避免"],',
    '  "studyPlan": [',
    '    { "title": "第 1 步：……", "steps": ["具体做法", "自测方式"] }',
    '  ]',
    '}',
    '',
    '约束：',
    `1. knowledgePoints 数量 8–30 个，必须覆盖全部课件，重要度按 high/medium/low 标注；page 填对应课件页码，无法确定则填 null；`,
    '2. examPoints 按重要度从高到低排序，3–15 个；',
    '3. pitfalls 2–10 条；studyPlan 3–6 步，适合考前 7 天执行；',
    '4. 只使用笔记中出现的内容，不编造；',
    '5. 输出必须是合法 JSON，字符串中不要出现未转义换行。',
  )
  return lines.join('\n')
}

export const PAGE_CHAT_SYSTEM =
  '你是学生的私人学习教练，正在陪他看雨课堂课件。回答要基于当前页可见内容，先直接回答问题，再解释依据；如果学生标注了区域，优先解释标注处。用中文，条理清楚，不编造页面没有的信息。'

export function describeAnnotations(annotations) {
  const strokes = list(annotations).filter(isRecord).slice(0, 12)
  if (!strokes.length) return ''
  const parts = []
  strokes.forEach((stroke, index) => {
    const points = list(stroke.points)
      .filter((point) => Array.isArray(point) && point.length >= 2)
      .map((point) => [Math.max(0, Math.min(1, Number(point[0]) || 0)), Math.max(0, Math.min(1, Number(point[1]) || 0))])
    if (!points.length) return
    let minX = 1
    let maxX = 0
    let minY = 1
    let maxY = 0
    for (const point of points) {
      if (point[0] < minX) minX = point[0]
      if (point[0] > maxX) maxX = point[0]
      if (point[1] < minY) minY = point[1]
      if (point[1] > maxY) maxY = point[1]
    }
    const tool = stroke.tool === 'highlight' ? '高亮划线' : stroke.tool === 'pen' ? '圈画/画笔' : '标注'
    parts.push(
      `${index + 1}. ${tool}：横向 ${Math.round(minX * 100)}%–${Math.round(maxX * 100)}%，纵向 ${Math.round(minY * 100)}%–${Math.round(maxY * 100)}%`,
    )
  })
  return parts.join('；')
}

export function buildPageChatText(options = {}) {
  const course = text(options.courseName, 120)
  const lesson = text(options.lessonTitle, 160)
  const index = Math.max(1, Number(options.pageIndex) || 1)
  const count = Math.max(index, Number(options.pageCount) || index)
  const question = text(options.question, 4000)
  const annotationText = text(options.annotationText, 2000)
  const history = list(options.history)
    .filter((item) => isRecord(item) && (item.role === 'user' || item.role === 'assistant') && text(item.text, 1))
    .slice(-8)
  const lines = [
    '【当前课件】',
    course ? `课程：${course}` : '',
    lesson ? `课时：${lesson}` : '',
    `页码：第 ${index} 页 / 共 ${count} 页`,
  ].filter(Boolean)
  if (annotationText) lines.push('', '【学生在本页的标注】', annotationText)
  if (history.length) {
    lines.push('', '【对话历史】')
    for (const item of history) {
      lines.push(`${item.role === 'user' ? '学生' : '你'}：${text(item.text, 3000)}`)
    }
  }
  lines.push('', '【当前问题】', question)
  lines.push('', '请结合随附的课件页面图片回答；若随附了标注层图片，它是与页面同尺寸的透明标注层，请优先解释标注处。')
  return lines.join('\n')
}

function cleanPage(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null
}

export function normalizeSummary(raw, fallback = {}) {
  if (!isRecord(raw)) return null
  const knowledgePoints = list(raw.knowledgePoints || raw.knowledge_points || raw.points || raw['知识点'])
    .filter((item) => isRecord(item) || text(item, 1))
    .map((item) => (isRecord(item) ? {
      name: text(item.name || item.point || item.title || item['名称'] || item['知识点'], 300),
      detail: text(item.detail || item.description || item.explanation || item['解释'] || item['说明'], 3000),
      importance: oneOf(item.importance || item.level || item['重要度'], ['high', 'medium', 'low'], 'medium'),
      page: cleanPage(item.page || item.slide || item.pageNumber || item['页码']),
    } : {
      name: text(item, 300),
      detail: '',
      importance: 'medium',
      page: null,
    }))
    .filter((item) => item.name)
    .slice(0, 40)
  const examPoints = list(raw.examPoints || raw.exam_points || raw['考点'])
    .filter((item) => isRecord(item) || text(item, 1))
    .map((item) => (isRecord(item) ? {
      name: text(item.name || item.point || item.title || item['名称'], 300),
      why: text(item.why || item.reason || item.description || item['为什么'], 2000),
      how: text(item.how || item.howTo || item.answer || item.method || item['怎么答'], 2000),
    } : {
      name: text(item, 300),
      why: '',
      how: '',
    }))
    .filter((item) => item.name)
    .slice(0, 30)
  const pitfalls = list(raw.pitfalls || raw.pitfall || raw.commonMistakes || raw['易错点'])
    .map((item) => (isRecord(item) ? text(item.text || item.name || item.description, 1200) : text(item, 1200)))
    .filter(Boolean)
    .slice(0, 20)
  const studyPlan = list(raw.studyPlan || raw.study_plan || raw.plan || raw['复习计划'])
    .filter(isRecord)
    .map((item) => {
      const rawSteps = item.steps || item.items || item.detail
      const steps = typeof rawSteps === 'string' ? [rawSteps] : list(rawSteps)
      return {
        title: text(item.title || item.name || item.step, 300),
        steps: steps
          .map((step) => (isRecord(step) ? text(step.text || step.name, 800) : text(step, 800)))
          .filter(Boolean)
          .slice(0, 12),
      }
    })
    .filter((item) => item.title || item.steps.length)
    .slice(0, 10)
  if (!knowledgePoints.length && !examPoints.length) return null
  return {
    title: text(raw.title || raw['标题'], 300) || text(fallback.title, 300) || '知识点总结',
    overview: text(raw.overview || raw.summary || raw.intro || raw['概述'], 4000),
    knowledgePoints,
    examPoints,
    pitfalls,
    studyPlan,
  }
}

/** Parse the model's JSON, tolerating ```json fences and leading prose. */
export function parseSummaryJson(value) {
  const raw = text(value, 200000)
  if (!raw) return null
  const candidates = []
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1])
  candidates.push(raw)
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1))
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      const normalized = normalizeSummary(parsed)
      if (normalized) return normalized
    } catch {
      /* try the next candidate */
    }
  }
  return null
}

export function fallbackSummary(rawText, meta = {}) {
  return {
    title: text(meta.title, 300) || '知识点总结',
    overview: text(rawText, 8000),
    knowledgePoints: [],
    examPoints: [],
    pitfalls: [],
    studyPlan: [],
    raw: true,
  }
}

export function summaryToMarkdown(summary, meta = {}) {
  if (!isRecord(summary)) return ''
  const lines = [`# ${text(summary.title, 300) || text(meta.title, 300) || '知识点总结'}`]
  if (meta.courseName) lines.push(`课程：${text(meta.courseName, 120)}`)
  if (meta.lessonTitle) lines.push(`课时：${text(meta.lessonTitle, 160)}`)
  if (meta.generatedAt) lines.push(`生成时间：${new Date(meta.generatedAt).toLocaleString('zh-CN')}`)
  if (summary.overview) lines.push('', text(summary.overview, 6000))
  if (list(summary.knowledgePoints).length) {
    lines.push('', '## 核心知识点')
    list(summary.knowledgePoints).forEach((point, index) => {
      const badge = point.importance === 'high' ? '【重点】' : point.importance === 'low' ? '【了解】' : '【掌握】'
      const page = point.page ? `（第 ${point.page} 页）` : ''
      lines.push(`${index + 1}. ${badge}${point.name}${page}`)
      if (point.detail) lines.push(`   ${point.detail}`)
    })
  }
  if (list(summary.examPoints).length) {
    lines.push('', '## 考点清单')
    list(summary.examPoints).forEach((point, index) => {
      lines.push(`${index + 1}. ${point.name}`)
      if (point.why) lines.push(`   为什么考：${point.why}`)
      if (point.how) lines.push(`   怎么答：${point.how}`)
    })
  }
  if (list(summary.pitfalls).length) {
    lines.push('', '## 易错点 / 易混点')
    list(summary.pitfalls).forEach((item) => lines.push(`- ${item}`))
  }
  if (list(summary.studyPlan).length) {
    lines.push('', '## 复习计划')
    list(summary.studyPlan).forEach((step) => {
      lines.push(`### ${step.title}`)
      list(step.steps).forEach((item) => lines.push(`- ${item}`))
    })
  }
  return lines.join('\n')
}

export function summaryToCards(summary, meta = {}) {
  if (!isRecord(summary)) return []
  const deck = text(meta.deck, 60) || '雨课堂'
  const tags = ['雨课堂']
  if (meta.lessonTitle) tags.push(text(meta.lessonTitle, 30))
  const cards = []
  const seen = new Set()
  const push = (front, back) => {
    const cleanFront = text(front, 300)
    const cleanBack = text(back, 1800)
    if (!cleanFront || !cleanBack || seen.has(cleanFront)) return
    seen.add(cleanFront)
    cards.push({ front: cleanFront, back: cleanBack, deck: deck, tags: tags.slice(0, 4) })
  }
  for (const point of list(summary.knowledgePoints)) {
    const page = point.page ? `（课件第 ${point.page} 页）` : ''
    push(`请解释：${point.name}`, `${point.detail || point.name}${page}`)
    if (cards.length >= 20) break
  }
  if (cards.length < 20) {
    for (const point of list(summary.examPoints)) {
      push(`考点：${point.name}`, [point.why, point.how].filter(Boolean).join('\n'))
      if (cards.length >= 20) break
    }
  }
  return cards
}

// ---------------------------------------------------------------------------
// Knowledge board Q&A: the student right-clicks one knowledge point
// ---------------------------------------------------------------------------

export const BOARD_CHAT_SYSTEM =
  '你是学生的私人学习教练。学生在知识看板上选中了一个知识点向你提问。回答要紧扣这个知识点在知识树中的位置（上级、下级、同级），先直接回答，再给依据；有课件页面时以课件为准，不编造课件里没有的结论。用中文，条理清楚，适合期末复习。'

function labelList(value, max) {
  return list(value).map((item) => text(item, 60)).filter(Boolean).slice(0, max)
}

export function buildBoardChatText(options = {}) {
  const node = isRecord(options.node) ? options.node : {}
  const label = text(node.label, 60)
  const pages = cleanPages(node.pages)
  const path = labelList(options.path, 12)
  const children = labelList(options.children, 24)
  const siblings = labelList(options.siblings, 24)
  const history = list(options.history)
    .filter((item) => isRecord(item) && (item.role === 'user' || item.role === 'assistant') && text(item.text, 1))
    .slice(-8)
  const lines = ['【当前课时】']
  const course = text(options.courseName, 120)
  const lesson = text(options.lessonTitle, 160)
  if (course) lines.push(`课程：${course}`)
  if (lesson) lines.push(`课时：${lesson}`)
  lines.push('', '【选中的知识点】', `名称：${label}`)
  const detail = text(node.detail, 300)
  if (detail) lines.push(`看板上的解释：${detail}`)
  if (pages.length) lines.push(`对应课件页：${pages.join('、')}`)
  const importance = node.importance === 'high' ? '重点' : node.importance === 'low' ? '了解' : '掌握'
  lines.push(`重要度：${importance}`)
  const tree = text(options.treeTitle, 60)
  lines.push('', '【它在知识树中的位置】')
  if (tree) lines.push(`所在知识树：${tree}`)
  lines.push(`从树根到它：${path.length ? path.concat([label]).join(' → ') : label}`)
  if (children.length) lines.push(`它的下级知识点：${children.join('、')}`)
  if (siblings.length) lines.push(`同级知识点：${siblings.join('、')}`)
  if (history.length) {
    lines.push('', '【对话历史】')
    for (const item of history) lines.push(`${item.role === 'user' ? '学生' : '你'}：${text(item.text, 3000)}`)
  }
  lines.push('', '【当前问题】', text(options.question, 4000))
  if (options.withImages) lines.push('', '随附图片是这个知识点对应的课件页，请结合页面内容回答。')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Knowledge board: AI-grown knowledge trees streamed as JSON Lines operations
// ---------------------------------------------------------------------------

export const BOARD_LIMITS = Object.freeze({ trees: 16, nodes: 500 })

export const TREE_SYSTEM =
  '你是知识结构设计师，负责把课件笔记组织成知识树。你只输出 JSON Lines（每行一个 JSON 对象），不输出任何其他文字。'

export function createBoard() {
  return { version: 0, seq: 0, trees: [], nodes: {}, lastNodeId: '' }
}

function cleanId(value) {
  const raw = text(value, 60)
  return /^[A-Za-z0-9_-]{1,40}$/.test(raw) ? raw : ''
}

function cleanPages(value) {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value]
  const pages = []
  for (const item of raw) {
    const page = cleanPage(item)
    if (page && pages.indexOf(page) < 0) pages.push(page)
    if (pages.length >= 8) break
  }
  return pages.sort((left, right) => left - right)
}

function treeById(board, id) {
  return board.trees.filter((tree) => tree.id === id)[0] || null
}

/** Ids the model should use next, so it never collides with existing ones. */
export function nextBoardIds(board) {
  let tree = 0
  let node = 0
  for (const item of board.trees) {
    const match = /^t(\d+)$/.exec(item.id)
    if (match) tree = Math.max(tree, Number(match[1]))
  }
  for (const id of Object.keys(board.nodes)) {
    const match = /^n(\d+)$/.exec(id)
    if (match) node = Math.max(node, Number(match[1]))
  }
  return { tree: `t${tree + 1}`, node: `n${node + 1}` }
}

function isDescendant(board, candidate, ancestor) {
  let current = board.nodes[candidate]
  let guard = 0
  while (current && guard < 1000) {
    if (current.id === ancestor) return true
    current = current.parent ? board.nodes[current.parent] : null
    guard += 1
  }
  return false
}

function moveSubtree(board, nodeId, treeId) {
  const stack = [nodeId]
  while (stack.length) {
    const id = stack.pop()
    const node = board.nodes[id]
    if (!node) continue
    node.tree = treeId
    for (const child of Object.values(board.nodes)) {
      if (child.parent === id) stack.push(child.id)
    }
  }
}

function ensureTree(board, id, title) {
  const existing = treeById(board, id)
  if (existing) return existing
  if (board.trees.length >= BOARD_LIMITS.trees) return null
  board.seq += 1
  const tree = { id, title: text(title, 40) || '知识树', seq: board.seq }
  board.trees.push(tree)
  return tree
}

function patchNode(node, op) {
  const label = text(op.label || op.name || op.title, 40)
  if (label) node.label = label
  const detail = text(op.detail || op.desc || op.description, 160)
  if (detail) node.detail = detail
  if (op.pages !== undefined || op.page !== undefined) {
    const pages = cleanPages(op.pages !== undefined ? op.pages : op.page)
    if (pages.length) node.pages = cleanPages(node.pages.concat(pages))
  }
  if (op.importance !== undefined) node.importance = oneOf(op.importance, ['high', 'medium', 'low'], node.importance)
}

/**
 * Apply one model operation to the board in place. Unknown or invalid
 * operations are ignored, never thrown: a half-good stream still grows the
 * board. Returns true when the board changed.
 *
 *   {"op":"tree","id":"t1","title":"…"}
 *   {"op":"node","id":"n1","tree":"t1","parent":null|"nX","label":"…","detail":"…","pages":[3],"importance":"high"}
 *   {"op":"update","id":"n1",…fields}
 *   {"op":"move","id":"n1","parent":"nX"|null,"tree":"t2"}
 *   {"op":"merge","from":"t2","into":"t1","parent":"nX"|null}
 */
export function applyTreeOp(board, op) {
  if (!isRecord(board) || !isRecord(op)) return false
  const kind = text(op.op || op.type, 20).toLowerCase()
  if (kind === 'tree') {
    const id = cleanId(op.id)
    if (!id) return false
    const existing = treeById(board, id)
    if (existing) {
      const title = text(op.title || op.label, 40)
      if (!title || title === existing.title) return false
      existing.title = title
      return true
    }
    return !!ensureTree(board, id, op.title || op.label)
  }
  if (kind === 'node' || kind === 'update') {
    const id = cleanId(op.id)
    if (!id) return false
    const existing = board.nodes[id]
    if (existing) {
      patchNode(existing, op)
      if (op.parent !== undefined || op.tree !== undefined) applyTreeOp(board, { op: 'move', id, parent: op.parent, tree: op.tree })
      return true
    }
    if (kind === 'update') return false
    if (Object.keys(board.nodes).length >= BOARD_LIMITS.nodes) return false
    const label = text(op.label || op.name || op.title, 40)
    if (!label) return false
    const parentId = cleanId(op.parent)
    const parent = parentId ? board.nodes[parentId] : null
    let tree = parent ? treeById(board, parent.tree) : treeById(board, cleanId(op.tree))
    if (!tree) {
      const treeId = cleanId(op.tree) || nextBoardIds(board).tree
      tree = ensureTree(board, treeId, op.treeTitle || label)
      if (!tree) tree = board.trees[board.trees.length - 1] || null
    }
    if (!tree) return false
    board.seq += 1
    board.nodes[id] = {
      id,
      tree: tree.id,
      parent: parent && parent.tree === tree.id ? parent.id : null,
      label,
      detail: text(op.detail || op.desc || op.description, 160),
      pages: cleanPages(op.pages !== undefined ? op.pages : op.page),
      importance: oneOf(op.importance, ['high', 'medium', 'low'], 'medium'),
      seq: board.seq,
    }
    board.lastNodeId = id
    return true
  }
  if (kind === 'move') {
    const node = board.nodes[cleanId(op.id)]
    if (!node) return false
    const parentId = cleanId(op.parent)
    if (parentId) {
      const parent = board.nodes[parentId]
      if (!parent || parent.id === node.id || isDescendant(board, parent.id, node.id)) return false
      if (node.parent === parent.id) return false
      node.parent = parent.id
      if (node.tree !== parent.tree) moveSubtree(board, node.id, parent.tree)
      return true
    }
    const tree = treeById(board, cleanId(op.tree))
    if (op.parent === null || tree) {
      const changed = node.parent !== null || (tree && tree.id !== node.tree)
      node.parent = null
      if (tree && tree.id !== node.tree) moveSubtree(board, node.id, tree.id)
      return !!changed
    }
    return false
  }
  if (kind === 'merge') {
    const from = treeById(board, cleanId(op.from))
    const into = treeById(board, cleanId(op.into))
    if (!from || !into || from.id === into.id) return false
    const anchor = board.nodes[cleanId(op.parent)]
    const anchorId = anchor && anchor.tree === into.id ? anchor.id : null
    for (const node of Object.values(board.nodes)) {
      if (node.tree !== from.id) continue
      node.tree = into.id
      if (!node.parent) node.parent = anchorId
    }
    board.trees = board.trees.filter((tree) => tree.id !== from.id)
    return true
  }
  return false
}

/** Compact outline the model sees on every update: ids, labels and pages. */
export function boardOutline(board, maxChars = 12000) {
  if (!isRecord(board) || !board.trees.length) return '（看板还是空的）'
  const children = new Map()
  for (const node of Object.values(board.nodes).sort((left, right) => left.seq - right.seq)) {
    const key = `${node.tree}|${node.parent || ''}`
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(node)
  }
  const lines = []
  const walk = (tree, parentId, depth) => {
    for (const node of children.get(`${tree}|${parentId}`) || []) {
      const pages = node.pages.length ? ` (p${node.pages.join(',')})` : ''
      lines.push(`${'  '.repeat(depth)}[${node.id}] ${node.label}${pages}`)
      walk(tree, node.id, depth + 1)
    }
  }
  for (const tree of board.trees) {
    lines.push(`[${tree.id}] 《${tree.title}》`)
    walk(tree.id, '', 1)
  }
  let outline = lines.join('\n')
  if (outline.length > maxChars) {
    // Keep the top two levels so the model can still place new knowledge.
    outline = lines.filter((line) => !/^ {6,}/.test(line)).join('\n')
    if (outline.length > maxChars) outline = outline.slice(0, maxChars)
    outline += '\n（更深层节点已省略）'
  }
  return outline
}

export function buildTreePrompt(options = {}) {
  const board = isRecord(options.board) ? options.board : createBoard()
  const ids = nextBoardIds(board)
  const lines = [
    `课程：${text(options.courseName, 120) || '未知课程'}；课时：${text(options.lessonTitle, 160) || '当前课时'}`,
    '',
    '【当前知识看板】',
    boardOutline(board),
    '',
    '【新读完的课件笔记】',
    text(options.notes, 24000),
    '',
    '请把新笔记里的知识点长进看板。只输出 JSON Lines，每行一个对象，可用的操作：',
    '{"op":"tree","id":"t1","title":"树的主题"}',
    '{"op":"node","id":"n1","tree":"t1","parent":null,"label":"知识点","detail":"一句话解释","pages":[3],"importance":"high"}',
    '{"op":"update","id":"n1","detail":"补充后的解释","pages":[7]}',
    '{"op":"move","id":"n5","parent":"n2"}',
    '{"op":"merge","from":"t2","into":"t1","parent":"n1"}',
    '',
    '规则：',
    '1. 知识之间有关联（上下位、定义→性质/定理→方法→例题、推导、应用、对比）就放进同一棵树，并尽量往下展开层级；只有与现有所有树都无关的主题才新建一棵树。',
    '2. 发现两棵树其实相关时，用 merge 把较小的树并到相关节点下；挂错位置的节点用 move 调整。',
    '3. 已有的树和节点用原 id 引用；同一知识点不要重复创建，需要补充时用 update。',
    `4. 新树 id 从 ${ids.tree} 开始递增，新节点 id 从 ${ids.node} 开始递增；先输出 tree 行，再输出它的节点；父节点必须先于子节点输出。`,
    '5. label 不超过 16 个字；detail 一句话、不超过 50 个字；pages 填对应课件页码；importance 取 high / medium / low。',
    '6. 只依据笔记内容，不编造；这次输出 3–30 行；不要代码块，不要解释。',
  ]
  return lines.join('\n')
}

/**
 * Incremental JSON Lines parser for streamed model text. Each complete line
 * that parses as an object is handed to `onOp` immediately; fences, bullets
 * and prose lines are skipped.
 */
export function createTreeOpParser(onOp) {
  let buffer = ''
  let count = 0
  const consume = (line) => {
    let raw = line.trim()
    if (!raw || raw.startsWith('```')) return
    raw = raw.replace(/^[-*•]\s*/, '').replace(/,\s*$/, '')
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return
    try {
      const op = JSON.parse(raw.slice(start, end + 1))
      if (isRecord(op)) {
        count += 1
        onOp(op)
      }
    } catch {
      /* not an operation line */
    }
  }
  return {
    push(chunk) {
      buffer += String(chunk || '')
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        consume(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
      }
    },
    end() {
      if (buffer) consume(buffer)
      buffer = ''
      return count
    },
  }
}
