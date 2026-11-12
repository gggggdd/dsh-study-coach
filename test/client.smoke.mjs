/**
 * Offline render smoke test for the Client half.
 *
 * Executes client.js against a tiny hook-aware React stub and renders every
 * visual surface with realistic state, catching reference/typing crashes in
 * the element trees without needing a browser.
 *
 * Run: node test/client.smoke.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'

function createReact() {
  const stack = []
  const current = () => {
    if (!stack.length) throw new Error('hook called outside a component')
    return stack[stack.length - 1]
  }
  const React = {
    Fragment: Symbol('Fragment'),
    createElement(type, props) {
      const children = Array.prototype.slice.call(arguments, 2)
      return {
        type,
        props: Object.assign({}, props || {}, {
          children: children.length <= 1 ? children[0] : children,
        }),
      }
    },
    useState(initial) {
      const hooks = current()
      const index = hooks.cursor++
      if (!(index in hooks.values)) hooks.values[index] = typeof initial === 'function' ? initial() : initial
      return [
        hooks.values[index],
        (next) => {
          hooks.values[index] = typeof next === 'function' ? next(hooks.values[index]) : next
        },
      ]
    },
    useEffect(fn) {
      const hooks = current()
      const index = hooks.cursor++
      hooks.values[index] = { cleanup: fn() }
    },
    useMemo(fn) {
      const hooks = current()
      const index = hooks.cursor++
      hooks.values[index] = fn()
      return hooks.values[index]
    },
    useCallback(fn) {
      const hooks = current()
      const index = hooks.cursor++
      hooks.values[index] = fn
      return fn
    },
    useRef(initial) {
      const hooks = current()
      const index = hooks.cursor++
      if (!(index in hooks.values)) hooks.values[index] = { current: initial }
      return hooks.values[index]
    },
  }
  const render = (node) => {
    if (node === null || node === undefined || node === false || node === true) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(render).join('')
    if (typeof node.type === 'function') {
      const hooks = { cursor: 0, values: {} }
      stack.push(hooks)
      try {
        return render(node.type(node.props || {}))
      } finally {
        stack.pop()
      }
    }
    if (node.type === React.Fragment) return render(node.props.children)
    return render(node.props && node.props.children)
  }
  return { React, render }
}

const { React, render } = createReact()
const registrations = []
const styleTags = []

const fakeWindow = {
  __ModuleLoader__: {
    load(definition) {
      fakeWindow.definition = definition
    },
  },
  addEventListener() {},
  removeEventListener() {},
}
const fakeDocument = {
  createElement() {
    return { setAttribute() {}, appendChild() {}, parentNode: null, textContent: '' }
  },
  head: { appendChild() {} },
}

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
// eslint-disable-next-line no-new-func
new Function('window', 'document', 'console', source)(fakeWindow, fakeDocument, console)

assert.equal(fakeWindow.definition.id, '@local/dsh-study-coach')
const requested = []
const plugin = fakeWindow.definition.factory((name) => {
  requested.push(name)
  if (name === 'react') return React
  // react-dom is optional: without it the viewer renders inline.
  throw new Error('unexpected module: ' + name)
})
assert.ok(requested.includes('react-dom'), 'client asks for react-dom to portal the viewer')

const locale = {
  register: () => () => {},
  getSnapshot: () => ({ active: 'zh' }),
  bind: () => (key) => key,
}
const slots = {
  inject(owner, callback) {
    const effect = callback()
    registrations.push({ owner, effect })
    return () => {}
  },
  register(meta, component) {
    return { meta, component }
  },
}
const fakeCtx = {
  get(name) {
    if (name === 'locale') return locale
    if (name === 'slots') return slots
    if (name === 'layout') return { selectPanel() {} }
    return undefined
  },
  effect(fn) {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
}

plugin.apply(fakeCtx)

assert.deepEqual(
  registrations.map((entry) => entry.owner),
  ['main', 'sidebar.panellist', 'conversation.composer.dock'],
  'all three slots registered'
)

const test = plugin.__test
assert.ok(test, 'test seam present')
const zh = test.dictionaries.zh
const en = test.dictionaries.en
const missingInEn = Object.keys(zh).filter((key) => !(key in en))
const missingInZh = Object.keys(en).filter((key) => !(key in zh))
assert.deepEqual(missingInEn, [], 'every zh key has an en translation')
assert.deepEqual(missingInZh, [], 'every en key has a zh translation')

const t = (key, params) => {
  let text = zh[key] === undefined ? key : zh[key]
  if (params) {
    Object.keys(params).forEach((name) => {
      text = text.split('{' + name + '}').join(String(params[name]))
    })
  }
  return text
}

const now = Date.now()
const state = test.normalizeState({
  version: 1,
  createdAt: now,
  updatedAt: now,
  cards: [
    { id: 'a', front: '什么是间隔重复？', back: '按遗忘曲线安排复习。', deck: '学习方法', tags: ['记忆'], createdAt: now, due: now - 1000, interval: 0, ease: 2.5, reps: 0, lapses: 0, lastReview: null },
    { id: 'b', front: '主动回忆为什么有效？', back: '强化检索路径。', deck: '学习方法', tags: [], createdAt: now, due: now + 86400000, interval: 3, ease: 2.5, reps: 2, lapses: 0, lastReview: now - 86400000 },
    { id: 'c', front: '什么是元认知？', back: '对思考的觉察。', deck: '认知科学', tags: [], createdAt: now, due: now + 86400000 * 30, interval: 30, ease: 2.7, reps: 5, lapses: 0, lastReview: now - 86400000 * 20 },
  ],
  daily: { [new Date(now).toISOString().slice(0, 10)]: { reviews: 3, again: 0, hard: 1, good: 2, easy: 0 } },
  streak: { lastDay: new Date(now).toISOString().slice(0, 10), days: 4 },
})
assert.equal(state.cards.length, 3)
const stats = test.computeStats(state, 15)
assert.equal(stats.total, 3)
assert.equal(stats.due, 1)
assert.equal(stats.reviewedToday, 3)
assert.equal(stats.mastered, 1)
assert.equal(stats.learning, 1)

const graded = test.gradeCard(state.cards[0], 'good', now)
assert.equal(graded.interval, 1)
assert.equal(graded.reps, 1)

const view = (value) => ({ ns: 'study-coach', revision: 1, value: Object.assign({ dailyGoal: 15 }, value) })
const baseProps = { t, ctx: fakeCtx, state, view: view({ stateJson: JSON.stringify(state) }), setView() {}, onGoLibrary() {} }

const reviewStart = render(React.createElement(test.ReviewTab, baseProps))
assert.match(reviewStart, /开始今日复习/)

const emptyState = test.normalizeState(Object.assign({}, state, {
  cards: state.cards.map((card) => Object.assign({}, card, { due: now + 86400000 })),
}))
const reviewEmpty = render(React.createElement(test.ReviewTab, Object.assign({}, baseProps, {
  state: emptyState,
  view: view({ stateJson: JSON.stringify(emptyState) }),
})))
assert.match(reviewEmpty, /今天没有到期的卡片/)

const noneState = test.normalizeState({ version: 1, cards: [], daily: {}, streak: { lastDay: '', days: 0 } })
const reviewNone = render(React.createElement(test.ReviewTab, Object.assign({}, baseProps, {
  state: noneState,
  view: view({ stateJson: JSON.stringify(noneState) }),
})))
assert.match(reviewNone, /还没有卡片/)

const library = render(React.createElement(test.LibraryTab, baseProps))
assert.match(library, /新建卡片/)
assert.match(library, /什么是间隔重复/)
assert.match(library, /认知科学/)

const statsView = render(React.createElement(test.StatsTab, baseProps))
assert.match(statsView, /最近 7 天复习量/)
assert.match(statsView, /掌握分布/)
assert.match(statsView, /每日目标/)

const dock = render(React.createElement(test.StudyDock, Object.assign({}, baseProps, {
  state: undefined,
  view: undefined,
})))
assert.match(dock, /学习/)

// Loading shell of the page (no view yet).
const page = render(React.createElement(test.StudyPage, Object.assign({}, baseProps, { view: undefined, state: undefined })))
assert.match(page, /学习中心/)
assert.match(page, /正在读取学习数据/)

// Yuketang tab: initial render handles a logged-out status without crashing.
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { loggedIn: false, account: '', school: '', region: 'standard' } }) })
const yktRender = render(React.createElement(test.YktTab, { t: t, ctx: fakeCtx }))
assert.match(yktRender, /正在读取雨课堂数据|连接雨课堂/)
assert.ok(test.YktTab, 'YktTab exposed for smoke tests')

const summaryFixture = {
  title: '极限与连续',
  overview: '本课讲极限与连续。',
  knowledgePoints: [{ name: 'ε-δ 定义', detail: '对任意 ε…', importance: 'high', page: 2 }],
  examPoints: [{ name: '证明极限', why: '常见大题', how: '先放缩' }],
  pitfalls: ['δ 依赖 ε'],
  studyPlan: [{ title: '第 1 步', steps: ['默写定义'] }],
}
const summaryRender = render(React.createElement(test.YktSummaryView, {
  t: t,
  summary: summaryFixture,
  busyCards: false,
  onCopy() {},
  onCards() {},
  onRegenerate() {},
}))
assert.match(summaryRender, /核心知识点/)
assert.match(summaryRender, /考点清单/)
assert.match(summaryRender, /极限与连续/)
assert.equal(test.summaryMarkdown(summaryFixture).split('\n')[0], '# 极限与连续')

const pickerRender = render(React.createElement(test.YktModelPicker, {
  t: t,
  models: { providers: [{ id: 'magpie', name: 'Magpie', models: [{ id: 'm1', name: 'Vision', inputModalities: ['text', 'image'] }] }], override: { provider: 'magpie', model: 'm1' }, effective: { provider: 'magpie', model: 'm1' } },
  busy: false,
  onSave() {},
}))
assert.match(pickerRender, /跟随默认模型|Vision/)

const viewerRender = render(React.createElement(test.YktSlideViewer, {
  t: t,
  slides: [{ id: 's1', index: 1, cover: 'slides/1.png' }],
  index: 0,
  lessonId: 'L1',
  presentationId: 'P1',
  lessonTitle: '测试课',
  courseName: '测试课程',
  models: { providers: [], override: null, effective: null },
  modelBusy: false,
  onSaveModel() {},
  annotations: {},
  onAnnotationsChange() {},
  chats: {},
  onChatsChange() {},
  onIndex() {},
  onClose() {},
}))
assert.match(viewerRender, /本页 AI 对话/)
assert.match(viewerRender, /高亮/)
// The caption strip keeps the viewer chrome out of the desktop titlebar
// (window-drag region + native window buttons).
const captionAt = source.indexOf("className: 'sc-ykt-viewer-caption'")
assert.ok(captionAt > 0 && captionAt < source.indexOf("className: 'sc-ykt-viewer-head'"), 'caption strip precedes the toolbar')
assert.match(source, /html\[data-windows-titlebar\] \.sc-ykt-viewer-caption\{height:var\(--dsh-windows-titlebar-height/)
assert.match(source, /-webkit-app-region:no-drag/)

// Knowledge board: two trees, nested nodes, live state.
const boardRender = render(React.createElement(test.YktKnowledgeBoard, {
  t: t,
  live: true,
  board: {
    version: 4,
    seq: 6,
    lastNodeId: 'n3',
    trees: [{ id: 't1', title: '函数极限', seq: 1 }, { id: 't2', title: '连续性', seq: 5 }],
    nodes: {
      n1: { id: 'n1', tree: 't1', parent: null, label: 'ε-δ 定义', detail: '', pages: [3], importance: 'high', seq: 2 },
      n2: { id: 'n2', tree: 't1', parent: 'n1', label: '单侧极限', detail: '', pages: [], importance: 'medium', seq: 3 },
      n3: { id: 'n3', tree: 't1', parent: 'n2', label: '左极限', detail: '', pages: [4], importance: 'low', seq: 4 },
      n4: { id: 'n4', tree: 't2', parent: null, label: '间断点', detail: '', pages: [], importance: 'medium', seq: 6 },
    },
  },
}))
for (const label of ['知识看板', '函数极限', '连续性', 'ε-δ 定义', '单侧极限', '左极限', '间断点', 'AI 正在边读边长知识树']) {
  assert.ok(boardRender.indexOf(label) >= 0, 'board renders ' + label)
}
assert.ok(boardRender.indexOf('函数极限') < boardRender.indexOf('ε-δ 定义') && boardRender.indexOf('左极限') < boardRender.indexOf('连续性'), 'nodes render inside their trees in order')
assert.equal(render(React.createElement(test.YktKnowledgeBoard, { t: t, board: null, live: false, missing: false })), '')
assert.match(render(React.createElement(test.YktKnowledgeBoard, { t: t, board: null, live: true })), /知识树会在这里/)

const qrSvg = test.renderQrSvg('https://www.yuketang.cn/api/v3/user/login/app-web-qr?u=test&t=1')
assert.match(qrSvg, /^<svg/)
assert.ok(qrSvg.length > 1000, 'QR SVG generated')

// Rich answers: TeX becomes MathML, Markdown becomes elements.
const sinFormula = test.texToMathML('P_k(2j) = \\sin\\left(\\frac{k}{10000^{\\frac{2j}{d}}}\\right)', false)
assert.match(sinFormula, /^<math>/)
assert.match(sinFormula, /<msub><mi>P<\/mi><mrow><mi>k<\/mi><\/mrow><\/msub>/)
assert.match(sinFormula, /<mi mathvariant="normal">sin<\/mi>/)
assert.match(sinFormula, /<mfrac><mrow><mi>k<\/mi><\/mrow><mrow><msup><mn>10000<\/mn><mrow><mfrac>/)
assert.match(sinFormula, /<mo stretchy="true">\(<\/mo>/)
assert.match(test.texToMathML('\\sum_{i=1}^{n} x_i', true), /<math display="block"><mrow><munderover><mo largeop="true">∑<\/mo>/)
assert.match(test.texToMathML('j \\in [0, d/2-1]', false), /<mo>∈<\/mo>/)
assert.match(test.texToMathML('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', true), /<mtable><mtr><mtd>/)
assert.match(test.texToMathML('\\text{a<b}', false), /<mtext>a&lt;b<\/mtext>/, 'text is escaped')
assert.match(test.texToMathML('\\unknowncmd x', false), /<mtext>\\unknowncmd<\/mtext>/, 'unknown commands degrade to text')

const sample = [
  '你圈画标注的地方是 **正余弦公式**：',
  '*   **公式1（偶数维度）**：\\(P_k(2j) = \\sin\\left(\\frac{k}{10000^{\\frac{2j}{d}}}\\right)\\)',
  '*   **下方定义**：\\(k\\) 是位置',
  '',
  '### 1. 核心作用',
  '最核心的巧妙在分母里的 **\\(10000^{\\frac{2j}{d}}\\)**：',
  '$$X = X + P$$',
  '| 维度 | 函数 |',
  '| --- | --- |',
  '| 偶数 | $\\sin$ |',
].join('\n')
const rich = test.renderRich(sample, 'm')
const flatten = (node, out = []) => {
  if (Array.isArray(node)) { node.forEach((child) => flatten(child, out)); return out }
  if (node && typeof node === 'object') {
    out.push(node)
    if (node.props) flatten(node.props.children, out)
  }
  return out
}
const nodes = flatten(rich)
const maths = nodes.filter((node) => node.props && node.props.className && /sc-math/.test(node.props.className))
assert.ok(maths.length >= 5, 'all formulas render as MathML: ' + maths.length)
assert.ok(maths.every((node) => /^<math/.test(node.props.dangerouslySetInnerHTML.__html)))
assert.ok(maths.some((node) => /sc-math-block/.test(node.props.className)), 'display math is a block')
assert.ok(nodes.some((node) => node.type === 'ul'), 'bullets become a list')
assert.ok(nodes.some((node) => node.props && node.props.role === 'heading'), '### becomes a heading')
assert.ok(nodes.some((node) => node.type === 'strong' && flatten(node.props.children).some((child) => child.props && /sc-math/.test(child.props.className || ''))), 'math inside bold renders')
assert.ok(nodes.some((node) => node.type === 'table'), 'pipe tables render')

// eslint-disable-next-line no-console
console.log('client.smoke.mjs — all render assertions passed')
process.exit(0)
