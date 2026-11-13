/**
 * Offline test for the Host half. Boots the plugin against stub Cordis services
 * and exercises every `study` action plus the `/study` command.
 *
 * Run: node test/host.test.mjs
 */
import assert from 'node:assert/strict'
import { apply } from '../index.js'

const config = { stateJson: undefined, dailyGoal: 15 }
const updates = []
const registrations = { tools: [], commands: [], sections: [], contexts: [] }

const ctx = {
  fiber: { entry: { options: { id: 'study-coach' } } },
  effect(fn) {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  on() {
    return () => {}
  },
  get() {
    return undefined
  },
  settings: {
    configure() {
      return () => {}
    },
    async update(ns, patch) {
      updates.push({ ns, patch })
      if (typeof patch.stateJson === 'string') config.stateJson = patch.stateJson
      if (typeof patch.dailyGoal === 'number') config.dailyGoal = patch.dailyGoal
    },
  },
  tools: {
    register(definition) {
      registrations.tools.push(definition)
      return () => {}
    },
  },
  commands: {
    register(definition) {
      registrations.commands.push(definition)
      return () => {}
    },
  },
  systemPrompt: {
    section(definition) {
      registrations.sections.push(definition)
      return () => {}
    },
    context(definition) {
      registrations.contexts.push(definition)
      return () => {}
    },
  },
}

apply(ctx, config)

assert.equal(registrations.tools.length, 2, 'study and ykt tools registered')
assert.equal(registrations.tools.filter((tool) => tool.name === 'study').length, 1, 'study tool registered')
assert.equal(registrations.tools.filter((tool) => tool.name === 'ykt').length, 1, 'ykt tool registered')
assert.equal(registrations.commands.length, 1, 'one command registered')
assert.equal(registrations.commands[0].name, 'study')
assert.equal(registrations.sections.length, 1, 'one prompt section registered')
assert.equal(registrations.contexts.length, 1, 'one prompt context registered')

const tool = registrations.tools.find((item) => item.name === 'study')

async function run(args) {
  return tool.execute(args, {})
}

const stats0 = await run({ action: 'stats' })
assert.match(stats0.summary, /卡片总数：3/)
assert.match(stats0.summary, /今日待复习：3/)

const added = await run({
  action: 'add',
  cards: [
    { front: '什么是元认知？', back: '对自己思考过程的觉察与调节。', deck: '认知科学', tags: ['元认知'] },
    { front: '为什么睡眠有助于记忆？', back: '睡眠期间海马体会重放白天的经历，促进记忆巩固。', deck: '认知科学' },
  ],
})
assert.equal(added.ok, true)
assert.equal(added.cardIds.length, 2)

const due = await run({ action: 'due', limit: 2 })
assert.match(due.summary, /今日待复习 5 张（仅显示前 2 张，共 5 张）/)
assert.equal(due.summary.split('\n').filter((line) => /^\d+\. \[/.test(line)).length, 2)

const grade = await run({ action: 'grade', cardId: added.cardIds[0], grade: 'good' })
assert.match(grade.summary, /已记录「good」/)
assert.match(grade.summary, /间隔 1 天/)

const stats1 = await run({ action: 'stats' })
assert.match(stats1.summary, /今日已复习：1 \/ 15/)
assert.match(stats1.summary, /连续学习：1 天/)

const list = await run({ action: 'list', query: '元认知' })
assert.match(list.summary, /匹配 1 张/)

const updated = await run({ action: 'update', cardId: added.cardIds[0], front: '元认知是什么？' })
assert.match(updated.summary, /元认知是什么/)

const deleted = await run({ action: 'delete', cardIds: [added.cardIds[1]] })
assert.match(deleted.summary, /已删除 1 张卡片/)

const command = registrations.commands[0]
const status = await command.handler({ rawInput: '', agent: { id: 'x' } })
assert.equal(status.kind, 'success')
assert.match(status.text, /今日待复习/)

const addCommand = await command.handler({ rawInput: 'add 测试问题 | 测试答案', agent: { id: 'x' } })
assert.equal(addCommand.kind, 'success')
assert.match(addCommand.text, /已添加卡片/)

const contextText = registrations.contexts[0].text()
assert.match(contextText, /Learning deck: 5 cards/)

// Related cards can be consolidated without losing scheduling metadata.
const merged = await run({
  action: 'merge',
  cardIds: ['seed-spaced', 'seed-recall'],
  front: '间隔重复与主动回忆有什么关系？',
  back: '间隔重复安排复习时机；主动回忆负责把记忆提取出来，两者结合比反复阅读更有效。',
})
assert.match(merged.summary, /合并为一张/)
assert.equal(merged.cardIds[0], 'seed-spaced')
const mergedStats = await run({ action: 'stats' })
assert.match(mergedStats.summary, /卡片总数：4/)

// Persistence is written through the volatile Config field.
assert.ok(updates.length >= 4, 'state was persisted through settings.update')
assert.ok(updates.every((entry) => entry.ns === 'study-coach'))

const yktTool = registrations.tools.find((item) => item.name === 'ykt')
assert.ok(yktTool, 'ykt tool definition exists')
const yktStatus = await yktTool.execute({ action: 'status' }, {})
assert.equal(yktStatus.ok, true)
assert.match(yktStatus.summary, /尚未登录雨课堂/)

// eslint-disable-next-line no-console
console.log('host.test.mjs — all assertions passed; persisted snapshots:', updates.length)
process.exit(0)
