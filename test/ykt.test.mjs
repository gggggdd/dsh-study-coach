/**
 * Offline protocol tests for the Yuketang read-only client.
 * A mock fetch records the exact URL/headers each helper sends and returns
 * fixtures shaped like the documented student-side responses.
 */
import assert from 'node:assert/strict'
import {
  YktClient,
  listCourses,
  listActivities,
  getLessonInfo,
  getLessonSummary,
  listSlides,
  getReplayTimeline,
  getCourseProgress,
  getMindMap,
  getScoreDetail,
  slideImageUrl,
  isAllowedSlideUrl,
} from '../ykt.js'

const calls = []
const fixture = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ code: 0, data }) })

globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), headers: options.headers, method: options.method })
  const path = new URL(String(url)).pathname
  if (path === '/v2/api/web/courses/list') {
    return fixture({ list: [{ classroom_id: 'cls-1', course: { id: 'course-1', name: '数据结构' }, name: '2026 春 数据结构', teacher: { name: '张老师' }, term: 202601 }] })
  }
  if (path === '/v2/api/web/logs/learn/cls-1') {
    return fixture({ activities: [{ id: 'a1', type: 14, title: '第 3 讲 树', courseware_id: 'lesson-1', create_time: 1760000000000, is_finished: true, attend_status: true }] })
  }
  if (path === '/api/v3/classroom-report/student/lesson-info') {
    return fixture({ lessonId: 'lesson-1', lessonName: '第 3 讲 树', courseName: '数据结构', classroomName: '2026 春 数据结构', teacherName: '张老师', activityId: 'a1', presentationIds: ['pres-1', 'pres-2'] })
  }
  if (path === '/api/v3/lesson-summary/student') {
    return fixture({ lesson: { title: '第 3 讲 树' }, presentations: [{ id: 'pres-1', title: '树与二叉树', cover: 'cover-1', slidesCount: 2 }], checkIn: null })
  }
  if (path === '/api/v3/lesson-summary/student/presentation') {
    return fixture({ slides: [{ id: 's1', index: 2, cover: 'qn-slide-2' }, { id: 's2', index: 1, cover: 'qn-slide-1' }] })
  }
  if (path === '/api/v3/lesson-summary/replay') {
    return fixture({ lessonDuration: 5400000, timeLine: [{ type: 'slide', si: 1, pres: 'pres-1', dt: 1000 }, { type: 'slide', si: 2, pres: 'pres-1', dt: 2000 }, { type: 'event', code: 'problemon', title: '随堂题', dt: 3000 }] })
  }
  if (path === '/c27/online_courseware/schedule/course/progress/') {
    return fixture({ sku_id: 9, course_progress: [{ section_leaf_list: [{ id: 'leaf-1', name: '第 3 章 树', leaf_type: 6, is_locked: false, score_deadline: 1761000000000, progress: { status: 'done', user_score: 8, total_score: 10, done: 2, total: 3 } }] }] })
  }
  if (path === '/api/v3/lesson-summary/query-lesson-mind-map') {
    return fixture({ overallMindMap: { title: '树', children: [{ title: '二叉树' }] } })
  }
  if (path === '/api/v3/classroom-report/student/score-detail') {
    return fixture({ student_score: 88, score_detail: [{ name: '签到', percent: 20 }, { name: '课堂题', percent: 80 }], checkin: null })
  }
  throw new Error('unexpected URL ' + url)
}

const client = new YktClient('standard', 'abcdefgh12345678')
assert.equal(client.base, 'https://www.yuketang.cn')

const courses = await listCourses(client)
{
  const full = new YktClient('standard', 'csrftoken=csrf123; sessionid=abcdefgh12345678; university_id=2803; platform_id=3')
  await listCourses(full)
  const last = calls.at(-1)
  assert.equal(last.headers.Cookie, 'csrftoken=csrf123; sessionid=abcdefgh12345678; university_id=2803; platform_id=3')
  assert.equal(last.headers['x-csrftoken'], 'csrf123')
  assert.equal(last.headers['university-id'], '2803')
  assert.equal(last.headers.Referer, 'https://www.yuketang.cn/v2/web/index')
  assert.equal(last.headers['xt-agent'], 'web')
}
assert.deepEqual(courses[0], { classroomId: 'cls-1', courseId: 'course-1', name: '数据结构', className: '2026 春 数据结构', teacher: '张老师', term: 202601, universityId: undefined })
assert.match(calls[0].url, /\/v2\/api\/web\/courses\/list\?identity=2$/)
assert.equal(calls[0].headers.Cookie, 'sessionid=abcdefgh12345678')
assert.equal(calls[0].headers.xtbz, 'ykt')

const activities = await listActivities(client, 'cls-1', { page: 0, size: 50 })
assert.equal(activities.activities[0].type, 14)
assert.equal(activities.activities[0].coursewareId, 'lesson-1')

const info = await getLessonInfo(client, 'lesson-1')
assert.deepEqual(info.presentationIds, ['pres-1', 'pres-2'])

const summary = await getLessonSummary(client, 'lesson-1')
assert.equal(summary.presentations[0].slidesCount, 2)

const slides = await listSlides(client, 'pres-1', 'lesson-1')
assert.deepEqual(slides.map((slide) => slide.index), [1, 2], 'slides are sorted by index')

const replay = await getReplayTimeline(client, 'lesson-1')
assert.deepEqual(replay.shownSlideIndexes, [1, 2])
assert.equal(replay.durationMs, 5400000)

const progress = await getCourseProgress(client, 'cls-1', 'course-1')
assert.equal(progress.leaves[0].userScore, 8)
assert.match(calls.at(-1).url, /classroom_id=cls-1&course_id=course-1/)

const mindMap = await getMindMap(client, 'lesson-1')
assert.equal(mindMap.title, '树')

const score = await getScoreDetail(client, 'lesson-1')
assert.equal(score.studentScore, 88)
assert.equal(score.parts.length, 2)

assert.equal(slideImageUrl('qn-slide-1'), 'https://qn-scd1.yuketang.cn/qn-slide-1')
assert.equal(isAllowedSlideUrl('https://qn-scd1.yuketang.cn/qn-slide-1'), true)
assert.equal(isAllowedSlideUrl('https://evil.example.com/a.png'), false)
assert.equal(isAllowedSlideUrl('http://qn-scd1.yuketang.cn/a.png'), false)

// A business error is surfaced as YktError with code/nextAction.
globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ code: 50000, msg: '登录已失效' }) })
await assert.rejects(() => listCourses(client), (error) => {
  assert.equal(error.name, 'YktError')
  assert.equal(error.code, 50000)
  assert.equal(error.nextAction, 'login')
  return true
})

console.log('ykt.test.mjs — all protocol assertions passed; recorded calls:', calls.length)
process.exit(0)
