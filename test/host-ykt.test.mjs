/**
 * Integration test for the Host `ykt` tool: boots the whole plugin with stub
 * Cordis services and a mock Yuketang HTTP surface, then exercises every
 * read-only action and the login/logout config writes.
 */
import assert from 'node:assert/strict'
import { apply } from '../index.js'

const config = {
  stateJson: undefined,
  dailyGoal: 15,
  yktRegion: 'standard',
  yktAccount: '小同',
  yktSchool: '湖南工学院',
}
const updates = []
const tools = []
let credentialRecord = { kind: 'grant', payload: { sessionid: 'abcdefgh12345678', region: 'standard' } }

const ctx = {
  fiber: { entry: { options: { id: 'study-coach' } } },
  effect(fn) {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  on() { return () => {} },
  get(name) {
    if (name === 'attachments') {
      return {
        imageLimits: { maxImageBytes: 1024 * 1024, maxImagesPerMessage: 12 },
        async saveImage(input) { return { attachmentId: 'att-' + input.name, mediaType: input.mediaType, bytes: input.data.byteLength, width: 100, height: 60, name: input.name } },
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
    async update(ns, patch) {
      updates.push({ ns, patch })
      Object.assign(config, patch)
    },
  },
  tools: {
    register(definition) {
      tools.push(definition)
      return () => {}
    },
  },
  commands: { register() { return () => {} } },
  systemPrompt: { section() { return () => {} }, context() { return () => {} } },
}

const jsonResponse = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ code: 0, data }) })
const page = (body) => ({ ok: true, status: 200, headers: { get: () => 'image/png' }, arrayBuffer: async () => body })

globalThis.fetch = async (url) => {
  const parsed = new URL(String(url))
  const path = parsed.pathname
  if (path === '/api/v3/user/basic-info') return jsonResponse({ user_id: 'u-1', name: '小同', school: '湖南工学院' })
  if (path === '/v2/api/web/courses/list') {
    return jsonResponse({ list: [{ classroom_id: 'cls-1', course: { id: 'course-1', name: '数据结构' }, name: '2026 春 数据结构', teacher: { name: '张老师' }, term: 202601 }] })
  }
  if (path === '/v2/api/web/logs/learn/cls-1') {
    return jsonResponse({ activities: [{ id: 'a1', type: 14, title: '第 3 讲 树', courseware_id: 'lesson-1', create_time: 1760000000000, is_finished: true, attend_status: true }] })
  }
  if (path === '/api/v3/classroom-report/student/lesson-info') {
    return jsonResponse({ lessonId: 'lesson-1', lessonName: '第 3 讲 树', courseName: '数据结构', classroomName: '2026 春 数据结构', teacherName: '张老师', activityId: 'a1', presentationIds: ['pres-1'] })
  }
  if (path === '/api/v3/lesson-summary/student') {
    return jsonResponse({ lesson: { title: '第 3 讲 树' }, presentations: [{ id: 'pres-1', title: '树与二叉树', cover: 'cover-1', slidesCount: 2 }], checkIn: null })
  }
  if (path === '/api/v3/lesson-summary/student/presentation') {
    return jsonResponse({ slides: [{ id: 's1', index: 1, cover: 'qn-slide-1' }, { id: 's2', index: 2, cover: 'qn-slide-2' }] })
  }
  if (path === '/api/v3/lesson-summary/replay') {
    return jsonResponse({ lessonDuration: 5400000, timeLine: [{ type: 'slide', si: 1, pres: 'pres-1', dt: 1000 }, { type: 'slide', si: 2, pres: 'pres-1', dt: 2000 }] })
  }
  if (path === '/c27/online_courseware/schedule/course/progress/') {
    return jsonResponse({ course_progress: [{ section_leaf_list: [{ id: 'leaf-1', name: '第 3 章 树', leaf_type: 6, is_locked: false, score_deadline: 1761000000000, progress: { status: 'done', user_score: 8, total_score: 10 } }] }] })
  }
  if (path === '/api/v3/lesson-summary/query-lesson-mind-map') return jsonResponse({ overallMindMap: { title: '树', children: [{ title: '二叉树' }] } })
  if (path === '/api/v3/classroom-report/student/score-detail') return jsonResponse({ student_score: 88, score_detail: [{ name: '课堂题', percent: 80 }] })
  if (path.startsWith('/qn-slide-')) return page(new Uint8Array([1, 2, 3]))
  throw new Error('unexpected ykt URL ' + url)
}

apply(ctx, config)
const yktTool = tools.find((tool) => tool.name === 'ykt')
assert.ok(yktTool, 'ykt tool registered')
const run = (args) => yktTool.execute(args, {})

assert.match((await run({ action: 'status' })).summary, /已登录雨课堂：小同/)
assert.match((await run({ action: 'courses' })).summary, /数据结构/)
assert.match((await run({ action: 'activities', classroomId: 'cls-1' })).summary, /第 3 讲 树/)
assert.match((await run({ action: 'lesson', lessonId: 'lesson-1' })).summary, /树与二叉树/)
assert.match((await run({ action: 'slides', lessonId: 'lesson-1', presentationId: 'pres-1' })).summary, /第 1 页/)
assert.match((await run({ action: 'replay', lessonId: 'lesson-1' })).summary, /实际讲过的页：1, 2/)
assert.match((await run({ action: 'progress', classroomId: 'cls-1', courseId: 'course-1' })).summary, /第 3 章 树/)
assert.match((await run({ action: 'mind_map', lessonId: 'lesson-1' })).summary, /二叉树/)
assert.match((await run({ action: 'score', lessonId: 'lesson-1' })).summary, /本课得分：88/)

const analyzed = await run({ action: 'analyze', lessonId: 'lesson-1', classroomId: 'cls-1', courseId: 'course-1', attach: false })
assert.equal(analyzed.ok, true)
assert.match(analyzed.summary, /课件：树与二叉树/)
assert.match(analyzed.summary, /考点清单/)

const analyzedWithImages = await run({ action: 'analyze', lessonId: 'lesson-1', attach: true, maxSlides: 2 })
assert.equal(analyzedWithImages.ok, true)
assert.equal(analyzedWithImages.images.length, 2, 'two slide images attached')
const rendered = yktTool.output.render({}, analyzedWithImages)
assert.equal(rendered.filter((block) => block.type === 'image').length, 2)

const login = await run({ action: 'login', sessionid: 'zzzzzzzzzzzzzzzz', region: 'changjiang' })
assert.equal(login.ok, true)
assert.equal(credentialRecord.payload.sessionid, 'zzzzzzzzzzzzzzzz')
assert.equal(config.yktRegion, 'changjiang')
assert.match(login.summary, /小同/)

const logout = await run({ action: 'logout' })
assert.equal(logout.ok, true)
assert.equal(credentialRecord, undefined)
assert.ok(updates.some((entry) => entry.ns === 'study-coach' && entry.patch.yktAccount === '小同'))

console.log('host-ykt.test.mjs — all integration assertions passed; tools:', tools.map((tool) => tool.name).join(','))
process.exit(0)
