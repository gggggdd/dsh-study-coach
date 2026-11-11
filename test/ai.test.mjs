/**
 * Pure AI-helper tests: model selection, tolerant JSON parsing, annotation
 * descriptions, summary->card conversion, and streaming against a fake llm.
 */
import assert from 'node:assert/strict'
import * as ai from '../ai.js'

const selection = ai.normalizeSelection({ provider: 'magpie', model: 'workbuddy/deepseek-v4.1-flash', reasoningEffort: 'max' })
assert.deepEqual(selection, { provider: 'magpie', model: 'workbuddy/deepseek-v4.1-flash', reasoningEffort: 'max' })
assert.equal(ai.normalizeSelection({ provider: '', model: 'x' }), null)

const fenced = '这里是一些说明：\n```json\n' + JSON.stringify({
  title: '极限与连续',
  overview: '本课讲极限定义与连续判断。',
  knowledgePoints: [
    { name: '极限的 ε-δ 定义', detail: '对任意 ε>0 存在 δ>0……', importance: '高', page: 3 },
    { name: '连续的三条件', detail: '左极限、右极限、函数值相等。', importance: 'medium' },
  ],
  examPoints: [{ name: '用定义证明极限', why: '常见大题', how: '先放缩再取 δ' }],
  pitfalls: ['忽略 δ 依赖 ε'],
  studyPlan: [{ title: '第 1 步：刷定义', steps: ['抄写定义', '做三道证明'] }],
}, null, 2) + '\n```\n'
const parsed = ai.parseSummaryJson(fenced)
assert.ok(parsed, 'fenced JSON parsed')
assert.equal(parsed.title, '极限与连续')
assert.equal(parsed.knowledgePoints.length, 2)
assert.equal(parsed.knowledgePoints[0].importance, 'high', 'Chinese importance normalized')
assert.equal(parsed.knowledgePoints[0].page, 3)

const annotation = ai.describeAnnotations([
  { tool: 'highlight', points: [[0.1, 0.2], [0.5, 0.2]] },
  { tool: 'pen', points: [[0.4, 0.4], [0.6, 0.7]] },
])
assert.match(annotation, /高亮划线/)
assert.match(annotation, /横向 10%–50%/)
assert.match(annotation, /圈画\/画笔/)
assert.match(annotation, /纵向 40%–70%/)

const cards = ai.summaryToCards(parsed, { deck: '雨课堂 · 极限', lessonTitle: '极限与连续' })
assert.ok(cards.length >= 2, 'knowledge points become cards')
assert.equal(cards[0].deck, '雨课堂 · 极限')
assert.match(cards[0].front, /请解释：/)

const pageText = ai.buildPageChatText({
  courseName: '高等数学',
  lessonTitle: '极限',
  pageIndex: 3,
  pageCount: 10,
  question: '这页的 δ 怎么取？',
  annotationText: '高亮划线：横向 10%–50%',
  history: [{ role: 'user', text: '上一问' }, { role: 'assistant', text: '上一答' }],
})
assert.match(pageText, /第 3 页 \/ 共 10 页/)
assert.match(pageText, /对话历史/)
assert.match(pageText, /高亮划线/)

let calls = 0
const llm = {
  async resolveModelInfo() { return { inputModalities: ['text', 'image'] } },
  async *stream(options) {
    calls += 1
    assert.equal(options.provider, 'magpie')
    assert.ok(Array.isArray(options.messages))
    yield { type: 'text-delta', text: calls === 1 ? '第一段回答' : '第二段回答' }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
}
const first = await ai.streamText(llm, selection, { messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], requireImage: true, maxTokens: 10 })
assert.equal(first.text, '第一段回答')
assert.equal(calls, 1)

const noVision = {
  async resolveModelInfo() { return { inputModalities: ['text'] } },
  async *stream() { throw new Error('must not stream') },
}
await assert.rejects(
  () => ai.streamText(noVision, selection, { messages: [], requireImage: true }),
  /不支持图片输入/
)

assert.deepEqual(ai.summaryToCards(null), [])

// Reasoning effort is only sent when the exact model lists it.
const reasoningInfo = { reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }, { id: 'max', name: 'Max' }] } }
assert.equal(ai.pickReasoningEffort(reasoningInfo, 'least'), 'low')
assert.equal(ai.pickReasoningEffort(reasoningInfo, 'high'), 'high')
assert.equal(ai.pickReasoningEffort({ reasoning: { efforts: [{ id: 'medium' }] } }, 'high'), undefined)
assert.equal(ai.pickReasoningEffort({ inputModalities: ['text'] }, 'least'), undefined)
assert.equal(ai.pickReasoningEffort(null, 'least'), undefined)
assert.equal(ai.isRateLimitError({ code: 'RATE_LIMIT' }), true)
assert.equal(ai.isRateLimitError({ status: 429 }), true)
assert.equal(ai.isRateLimitError({ code: 'AUTH', status: 401 }), false)

// Knowledge board: streamed JSON Lines -> tree operations.
const board = ai.createBoard()
const applied = []
const parser = ai.createTreeOpParser((op) => { if (ai.applyTreeOp(board, op)) applied.push(op.op) })
const stream = [
  '```jsonl',
  '{"op":"tree","id":"t1","title":"函数极限"}',
  '{"op":"node","id":"n1","tree":"t1","parent":null,"label":"ε-δ 定义","pages":[3,3,2],"importance":"高"}',
  '- {"op":"node","id":"n2","parent":"n1","label":"单侧极限"},',
  '好的，下面继续',
  '{"op":"node","id":"n3","tree":"t9","label":"间断点"}',
  '{"op":"move","id":"n1","parent":"n2"}',
  '{"op":"update","id":"n2","detail":"左、右极限","pages":[5]}',
  '{"op":"merge","from":"t9","into":"t1","parent":"n2"}',
  '```',
].join('\n')
for (let i = 0; i < stream.length; i += 5) parser.push(stream.slice(i, i + 5))
assert.equal(parser.end(), 7)
assert.deepEqual(applied, ['tree', 'node', 'node', 'node', 'update', 'merge'], 'cycle-making move is rejected')
assert.deepEqual(board.nodes.n1.pages, [2, 3])
assert.equal(board.nodes.n1.importance, 'high')
assert.equal(board.nodes.n2.tree, 't1')
assert.equal(board.nodes.n2.detail, '左、右极限')
assert.deepEqual(board.trees.map((tree) => tree.id), ['t1'], 'unknown tree id became a tree, then merged')
assert.equal(board.nodes.n3.parent, 'n2')
assert.deepEqual(ai.nextBoardIds(board), { tree: 't2', node: 'n4' })
assert.match(ai.boardOutline(board), /\[t1\] 《函数极限》\n  \[n1\] ε-δ 定义 \(p2,3\)\n    \[n2\] 单侧极限/)
const treePrompt = ai.buildTreePrompt({ board, notes: '第 7 页：连续的定义' })
assert.match(treePrompt, /新节点 id 从 n4 开始/)
assert.match(treePrompt, /第 7 页：连续的定义/)
const full = ai.createBoard()
for (let i = 0; i < ai.BOARD_LIMITS.nodes + 5; i += 1) ai.applyTreeOp(full, { op: 'node', id: 'x' + i, tree: 't1', label: 'k' + i })
assert.equal(Object.keys(full.nodes).length, ai.BOARD_LIMITS.nodes, 'node count is capped')

console.log('ai.test.mjs — all AI helper assertions passed')
