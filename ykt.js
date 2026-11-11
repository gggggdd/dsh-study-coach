/**
 * 雨课堂（Yuketang）学生端只读接口客户端。
 *
 * 接口来自对学生端 Web/App 的协议还原，以及公开的 yuketang-mcp（MIT）实现中的
 * 请求契约。这里只做读取：课程、活动、课件、回放时间线、章节进度、思维导图、
 * 笔记与得分构成。签到、答题、发弹幕等有副作用的操作刻意不实现。
 */

export const REGIONS = {
  standard: 'www.yuketang.cn',
  hetang: 'pro.yuketang.cn',
  changjiang: 'changjiang.yuketang.cn',
  huanghe: 'huanghe.yuketang.cn',
}

export const REGION_NAMES = {
  standard: '雨课堂',
  hetang: '荷塘雨课堂',
  changjiang: '长江雨课堂',
  huanghe: '黄河雨课堂',
}

export const REGION_KEYS = Object.keys(REGIONS)

export function isRegion(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(REGIONS, value)
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export class YktError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'YktError'
    this.code = options.code
    this.family = options.family
    this.status = options.status
    this.retryable = options.retryable === true
    this.nextAction = options.nextAction
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

function num(value) {
  return typeof value === 'number' ? value : Number(value) || 0
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function readStatus(payload) {
  if (!isRecord(payload)) return { ok: false, family: 'code', message: '响应不是 JSON 对象' }
  if (typeof payload.success === 'boolean') {
    return {
      ok: payload.success === true,
      code: payload.error_code !== undefined ? payload.error_code : payload.sub_code,
      family: 'success',
      message: typeof payload.msg === 'string' ? payload.msg : '',
    }
  }
  if (typeof payload.errcode === 'number' || typeof payload.errcode === 'string') {
    const raw = payload.errcode
    return {
      ok: raw === 0 || raw === '0',
      code: raw,
      family: 'errcode',
      message: typeof payload.errmsg === 'string' ? payload.errmsg : '',
    }
  }
  const raw = payload.code
  return {
    ok: raw === 0 || raw === '0',
    code: raw,
    family: 'code',
    message: typeof payload.msg === 'string' ? payload.msg : '',
  }
}

function classify(code) {
  const n = typeof code === 'string' ? Number(code) : code
  if (n === 50000 || n === 401000 || n === 401002 || n === 10005) return { retryable: false, nextAction: 'login' }
  if (n === 40000) return { retryable: false, nextAction: 'send xtbz: ykt header' }
  if (n === 80005) return { retryable: false, nextAction: 'use xtbz: ykt instead of cloud' }
  if (n === 80019) return { retryable: false, nextAction: 'use course progress instead of chapter' }
  if (n === 20009 || n === 20007) return { retryable: false, nextAction: 'resource not readable with current role' }
  if (n === 50401) return { retryable: false, nextAction: 'check query parameter naming' }
  return { retryable: false }
}

export function normalizeSession(value) {
  return normalizeCookie(value).sessionid
}

/**
 * Accept either a bare sessionid or a full browser Cookie header. A full
 * cookie is strongly preferred: `/v2/api/web/courses/list` on some deployments
 * also needs `csrftoken` and `university_id`.
 */
export function normalizeCookie(value) {
  const raw = typeof value === 'string' ? value.trim().replace(/^cookie\s*:\s*/i, '') : ''
  if (!raw) throw new YktError('Cookie 不能为空，请从浏览器复制完整 Cookie 或 sessionid', { nextAction: 'copy cookie' })
  const map = new Map()
  for (const part of raw.split(';')) {
    const piece = part.trim()
    if (!piece) continue
    const eq = piece.indexOf('=')
    if (eq <= 0) continue
    const name = piece.slice(0, eq).trim()
    const val = piece.slice(eq + 1).trim()
    if (!name || /[\r\n]/.test(name) || /[\r\n]/.test(val)) continue
    map.set(name, val)
  }
  let sessionid = map.get('sessionid') || ''
  if (!sessionid) {
    const single = raw.replace(/^sessionid\s*=\s*/i, '').trim()
    if (/^[A-Za-z0-9._-]{8,512}$/.test(single)) {
      sessionid = single
      map.set('sessionid', single)
    }
  }
  if (!/^[A-Za-z0-9._-]{8,512}$/.test(sessionid)) {
    throw new YktError('Cookie 中缺少合法的 sessionid，请重新复制浏览器 Cookie', { nextAction: 'copy cookie' })
  }
  const cookie = [...map.entries()].map(([name, val]) => `${name}=${val}`).join('; ')
  return {
    cookie,
    sessionid,
    csrftoken: map.get('csrftoken') || '',
    universityId: map.get('university_id') || map.get('university-id') || '',
  }
}

export class YktClient {
  constructor(region, credential) {
    if (!isRegion(region)) throw new YktError(`未知的雨课堂区域：${String(region)}`)
    this.region = region
    this.host = REGIONS[region]
    const parsed = normalizeCookie(credential)
    this.cookie = parsed.cookie
    this.session = parsed.sessionid
    this.csrftoken = parsed.csrftoken
    this.universityId = parsed.universityId
  }

  get base() {
    return `https://${this.host}`
  }

  async call(path, options = {}) {
    const { method = 'GET', query, body, signal, timeoutMs = 25_000, headers: extraHeaders } = options
    const url = new URL(this.base + path)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
      }
    }
    const headers = {
      Accept: 'application/json, text/plain, */*',
      Cookie: this.cookie,
      'User-Agent': UA,
      xtbz: 'ykt',
      'xt-agent': 'web',
      Referer: `${this.base}/v2/web/index`,
    }
    if (this.csrftoken) headers['x-csrftoken'] = this.csrftoken
    if (this.universityId) {
      headers['university-id'] = this.universityId
      headers['uv-id'] = this.universityId
    }
    if (extraHeaders) Object.assign(headers, extraHeaders)
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    let response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        redirect: 'follow',
      })
    } catch (error) {
      throw new YktError(
        error && error.name === 'AbortError' ? '雨课堂请求超时' : `雨课堂网络错误：${String(error && error.message ? error.message : error)}`,
        { retryable: true, nextAction: 'retry' },
      )
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }

    this.absorbCookies(response)
    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    if (!response.ok) {
      const status = readStatus(payload)
      throw new YktError((payload && status.message) || `雨课堂 HTTP ${response.status} (${path})`, {
        ...classify(status.code),
        code: status.code,
        family: status.family,
        status: response.status,
        retryable: response.status >= 500 || response.status === 429,
      })
    }
    if (!text) throw new YktError('雨课堂返回了空响应', { status: response.status, retryable: true })
    if (!payload) throw new YktError('雨课堂返回的不是 JSON', { status: response.status })
    const status = readStatus(payload)
    if (!status.ok) {
      throw new YktError(status.message || `雨课堂业务错误 ${String(status.code)}`, {
        ...classify(status.code),
        code: status.code,
        family: status.family,
        status: response.status,
      })
    }
    return { status: response.status, payload }
  }

  async data(path, options = {}) {
    const { payload } = await this.call(path, options)
    if (!isRecord(payload) || payload.data === undefined) {
      throw new YktError('雨课堂响应缺少 data 字段', { nextAction: 'report schema change' })
    }
    return payload.data
  }

  absorbCookies(response) {
    const headers = response && response.headers
    if (!headers) return
    let raw = []
    try {
      raw = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
    } catch {
      raw = []
    }
    if (!raw.length) {
      const single = typeof headers.get === 'function' ? headers.get('set-cookie') : null
      if (single) raw = [single]
    }
    if (!raw.length) return
    const map = new Map()
    for (const part of this.cookie.split(';')) {
      const piece = part.trim()
      const eq = piece.indexOf('=')
      if (eq > 0) map.set(piece.slice(0, eq).trim(), piece.slice(eq + 1).trim())
    }
    for (const cookie of raw) {
      const first = String(cookie).split(';', 1)[0] || ''
      const eq = first.indexOf('=')
      if (eq <= 0) continue
      const name = first.slice(0, eq).trim()
      const value = first.slice(eq + 1).trim()
      if (!name || !value) continue
      map.set(name, value)
      if (name === 'csrftoken') this.csrftoken = value
      if (name === 'university_id') this.universityId = value
    }
    this.cookie = [...map.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  async verify() {
    const data = await this.data('/api/v3/user/basic-info')
    if (!isRecord(data)) throw new YktError('雨课堂用户信息格式异常')
    // Best-effort: the v2 userinfo endpoint often carries university_id, which
    // some deployments require on course-list requests. Keep it in the cookie
    // so later requests can send university-id/uv-id headers.
    try {
      const info = await this.data('/v2/api/web/userinfo')
      const rows = Array.isArray(info) ? info : isRecord(info) && Array.isArray(info.data) ? info.data : []
      const row = rows[0] && isRecord(rows[0]) ? rows[0] : info
      const uv = row && (row.university_id !== undefined ? row.university_id : row.universityId !== undefined ? row.universityId : row.uv_id)
      if (uv !== undefined && uv !== null && String(uv) !== '') {
        this.universityId = String(uv)
        if (!/(^|;\s*)university_id=/.test(this.cookie)) this.cookie += `; university_id=${this.universityId}`
      }
    } catch {
      /* optional enrichment */
    }
    return {
      userId: str(data.user_id || data.id || data.userId),
      name: str(data.name || data.nickname),
      school: str(data.school || data.school_name),
      avatar: str(data.avatar || data.avatar_96),
    }
  }
}

function recordOf(value) {
  return isRecord(value) ? value : {}
}

export async function listCourses(client) {
  const data = await client.data('/v2/api/web/courses/list', { query: { identity: 2 } })
  return asArray(recordOf(data).list).map((raw) => {
    const item = recordOf(raw)
    const course = recordOf(item.course)
    return {
      classroomId: str(item.classroom_id),
      courseId: str(course.id),
      name: str(course.name) || str(item.name),
      className: str(item.name),
      teacher: str(recordOf(item.teacher).name),
      term: num(item.term),
      universityId: typeof course.university_id === 'number' ? course.university_id : undefined,
    }
  })
}

export async function getClassroom(client, classroomId) {
  const data = await client.data(`/v2/api/web/classrooms/${encodeURIComponent(classroomId)}`, { query: { role: 5 } })
  const record = recordOf(data)
  return {
    name: str(record.name),
    courseName: str(record.course_name),
    uvId: typeof record.uv_id === 'number' ? record.uv_id : undefined,
    skuId: typeof record.free_sku_id === 'number' ? record.free_sku_id : undefined,
    courseId: str(record.course_id),
  }
}

export async function listActivities(client, classroomId, options = {}) {
  const size = Math.min(Math.max(options.size || 50, 1), 200)
  const page = Math.max(0, Number(options.page) || 0)
  const data = await client.data(`/v2/api/web/logs/learn/${encodeURIComponent(classroomId)}`, {
    query: { actype: -1, page, offset: size, sort: -1 },
    headers: { 'classroom-id': String(classroomId) },
  })
  const activities = asArray(recordOf(data).activities).map((raw) => {
    const item = recordOf(raw)
    const activity = {
      id: str(item.id),
      type: num(item.type),
      title: str(item.title),
      coursewareId: str(item.courseware_id),
      createTime: num(item.create_time),
      finished: item.is_finished === true,
    }
    if (item.attend_status !== undefined) activity.attended = item.attend_status === true
    return activity
  })
  return { activities, complete: activities.length < size, page }
}

export async function getLessonInfo(client, lessonId) {
  const data = await client.data('/api/v3/classroom-report/student/lesson-info', { query: { lesson_id: lessonId } })
  const record = recordOf(data)
  return {
    lessonId: str(record.lessonId) || lessonId,
    lessonName: str(record.lessonName),
    courseName: str(record.courseName),
    classroomName: str(record.classroomName),
    teacherName: str(record.teacherName),
    activityId: str(record.activityId),
    skuId: str(record.skuId) || undefined,
    presentationIds: asArray(record.presentationIds).map(str).filter(Boolean),
  }
}

export async function getLessonSummary(client, lessonId) {
  const data = await client.data('/api/v3/lesson-summary/student', { query: { lesson_id: lessonId } })
  const record = recordOf(data)
  const presentations = asArray(record.presentations).map((raw) => {
    const item = recordOf(raw)
    return {
      id: str(item.id),
      title: str(item.title),
      cover: str(item.cover),
      slidesCount: num(item.slidesCount),
    }
  })
  return {
    presentations,
    checkin: isRecord(record.checkIn) ? record.checkIn : null,
    lessonTitle: str(recordOf(record.lesson).title),
  }
}

/** Absolute CDN URL for one slide cover (host-side use). */
export function slideImageUrl(cover) {
  const value = str(cover)
  if (!value) return ''
  if (/^\/\//.test(value)) return `https:${value}`
  const absolute = /^https?:\/\//i.test(value) ? value : `https://qn-scd1.yuketang.cn/${value.replace(/^\/+/, '')}`
  return absolute.replace(/^http:\/\//i, 'https://')
}

/** True only for HTTPS Yuketang hosts; slide covers should never point elsewhere. */
export function isAllowedSlideUrl(value) {
  try {
    const url = new URL(String(value))
    if (url.protocol !== 'https:') return false
    return /(^|\.)yuketang\.cn$/i.test(url.hostname)
  } catch {
    return false
  }
}

export async function listSlides(client, presentationId, lessonId) {
  const data = await client.data('/api/v3/lesson-summary/student/presentation', {
    query: { presentation_id: presentationId, lesson_id: lessonId },
  })
  return asArray(recordOf(data).slides)
    .map((raw, index) => {
      const item = recordOf(raw)
      return {
        id: str(item.id),
        index: num(item.index) || index + 1,
        cover: str(item.cover),
        problem: isRecord(item.problem) ? item.problem : null,
      }
    })
    .sort((left, right) => left.index - right.index)
}

export async function getReplayTimeline(client, lessonId) {
  const data = await client.data('/api/v3/lesson-summary/replay', { query: { lesson_id: lessonId } })
  const record = recordOf(data)
  const events = []
  for (const raw of asArray(record.timeLine)) {
    const event = recordOf(raw)
    if (event.type === 'slide') {
      events.push({ kind: 'slide', slideIndex: num(event.si), presentationId: str(event.pres), at: num(event.dt) })
    } else {
      events.push({ kind: 'event', code: str(event.code) || undefined, title: str(event.title) || undefined, at: num(event.dt) })
    }
  }
  events.sort((left, right) => left.at - right.at)
  const shownSlideIndexes = [...new Set(events.filter((event) => event.kind === 'slide' && event.slideIndex).map((event) => event.slideIndex))].sort((a, b) => a - b)
  return { events, durationMs: num(record.lessonDuration), shownSlideIndexes }
}

export async function getCourseProgress(client, classroomId, courseId) {
  const data = await client.data('/c27/online_courseware/schedule/course/progress/', {
    query: { classroom_id: classroomId, course_id: courseId },
    headers: { 'classroom-id': String(classroomId) },
  })
  const leaves = []
  for (const sectionRaw of asArray(recordOf(data).course_progress)) {
    for (const leafRaw of asArray(recordOf(sectionRaw).section_leaf_list)) {
      const item = recordOf(leafRaw)
      const progress = recordOf(item.progress)
      const leaf = {
        name: str(item.name),
        leafId: str(item.id),
        leafType: num(item.leaf_type),
        locked: item.is_locked === true,
        scoreDeadline: num(item.score_deadline),
        status: str(progress.status),
      }
      if (progress.user_score !== undefined) leaf.userScore = num(progress.user_score)
      if (progress.total_score !== undefined) leaf.totalScore = num(progress.total_score)
      if (progress.done !== undefined) leaf.done = num(progress.done)
      if (progress.total !== undefined) leaf.total = num(progress.total)
      leaves.push(leaf)
    }
  }
  return { skuId: typeof recordOf(data).sku_id === 'number' ? recordOf(data).sku_id : undefined, leaves }
}

export async function getMindMap(client, lessonId) {
  const data = await client.data('/api/v3/lesson-summary/query-lesson-mind-map', { query: { lesson_id: lessonId } })
  const map = recordOf(data).overallMindMap
  return isRecord(map) ? map : null
}

export async function listLectureNotes(client, lessonId) {
  const data = await client.data('/api/v3/lesson-summary/query-lecture-note', { query: { lesson_id: lessonId } })
  const record = recordOf(data)
  return {
    notes: asArray(record.list).map((raw) => {
      const item = recordOf(raw)
      return { liveId: str(item.liveId), durationMs: num(item.duration) }
    }),
    taskStatus: num(record.taskStatus),
    visible: num(record.studentVisible) === 1,
  }
}

export async function getLectureNoteDetail(client, lessonId, liveId) {
  const data = await client.data('/api/v3/lesson-summary/query-lecture-note-detail', {
    query: { lesson_id: lessonId, liveId },
  })
  return asArray(recordOf(data).notes).map(recordOf)
}

export async function getScoreDetail(client, lessonId) {
  const data = await client.data('/api/v3/classroom-report/student/score-detail', { query: { lesson_id: lessonId } })
  const record = recordOf(data)
  return {
    studentScore: num(record.student_score),
    parts: asArray(record.score_detail).map((raw) => {
      const item = recordOf(raw)
      return { name: str(item.name), percent: num(item.percent) }
    }),
    checkin: isRecord(record.checkin) ? record.checkin : null,
  }
}

export async function listAnnouncements(client, classroomId, options = {}) {
  const data = await client.data('/v/discussion/v2/announcements/', {
    query: { cid: classroomId, limit: options.limit || 20, offset: options.offset || 0, type: 9 },
  })
  return asArray(recordOf(data).data).map(recordOf)
}

export async function listTopics(client, classroomId, options = {}) {
  const data = await client.data('/v/discussion/v2/topics/', {
    query: { cid: classroomId, limit: options.limit || 20, offset: options.offset || 0 },
  })
  return { count: num(recordOf(data).count), results: asArray(recordOf(data).results).map(recordOf) }
}


const LOGIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Request a login QR ticket. The platform returns QR content, not an image. */
export async function requestLoginQr(region) {
  if (!isRegion(region)) throw new YktError(`未知的雨课堂区域：${String(region)}`)
  const base = `https://${REGIONS[region]}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  let response
  try {
    response = await fetch(base + '/api/v3/user/login/app-web-pre-info', {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': LOGIN_UA,
        Referer: `${base}/web`,
      },
      redirect: 'follow',
      signal: controller.signal,
    })
  } catch (error) {
    throw new YktError(`获取二维码网络错误：${String(error && error.message ? error.message : error)}`, { retryable: true })
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) throw new YktError(`获取二维码失败：HTTP ${response.status}`, { retryable: response.status >= 500 })
  const payload = await response.json()
  const status = readStatus(payload)
  if (!status.ok) throw new YktError(status.message || '获取二维码被拒绝', { code: status.code })
  const data = recordOf(payload.data)
  if (!data.qrContent || !data.token) throw new YktError('二维码响应缺少 qrContent/token')
  return {
    region,
    qrContent: str(data.qrContent),
    token: str(data.token),
    issuedAt: Date.now(),
    expiresAt: Date.now() + 280_000,
  }
}

/** One long-poll attempt of the QR login. Returns waiting or success. */
export async function pollLogin(region, token, options = {}) {
  if (!isRegion(region)) throw new YktError(`未知的雨课堂区域：${String(region)}`)
  const base = `https://${REGIONS[region]}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 12_000)
  const onAbort = () => controller.abort()
  if (options.signal) options.signal.addEventListener('abort', onAbort, { once: true })
  let response
  try {
    response = await fetch(base + '/api/v3/user/login/app-web-login', {
      method: 'POST',
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'Content-Type': 'application/json',
        'User-Agent': LOGIN_UA,
        Referer: `${base}/web`,
      },
      body: JSON.stringify({ token }),
      redirect: 'follow',
      signal: controller.signal,
    })
  } catch (error) {
    if (error && error.name === 'AbortError') return { status: 'waiting', code: 'timeout' }
    throw new YktError(`登录轮询网络错误：${String(error && error.message ? error.message : error)}`, { retryable: true })
  } finally {
    clearTimeout(timer)
    if (options.signal) options.signal.removeEventListener('abort', onAbort)
  }
  const cookies = extractCookies(response)
  const text = await response.text()
  let payload = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = null }
  if (payload && Number(payload.code) === 0 && payload.data) {
    if (!cookies.sessionid) throw new YktError('登录成功但未收到 sessionid，请重试')
    const data = recordOf(payload.data)
    return { status: 'success', sessionid: cookies.sessionid, cookie: cookies.cookie, name: str(data.Name), userId: str(data.UserID) }
  }
  const code = payload && payload.code !== undefined ? payload.code : response.status
  if (Number(code) === 50400) return { status: 'expired', code }
  return { status: 'waiting', code, message: payload && typeof payload.msg === 'string' ? payload.msg : '' }
}

function extractCookies(response) {
  let raw = []
  try {
    raw = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  } catch { raw = [] }
  if (!raw.length) {
    const single = response.headers.get('set-cookie')
    if (single) raw = [single]
  }
  const map = new Map()
  for (const cookie of raw) {
    const first = String(cookie).split(';', 1)[0] || ''
    const eq = first.indexOf('=')
    if (eq <= 0) continue
    const name = first.slice(0, eq).trim()
    const value = first.slice(eq + 1).trim()
    if (!name || !value) continue
    map.set(name, value)
  }
  const sessionid = map.get('sessionid') || ''
  return {
    sessionid: /^[A-Za-z0-9._-]{8,512}$/.test(sessionid) ? sessionid : '',
    cookie: [...map.entries()].map(([name, value]) => `${name}=${value}`).join('; '),
  }
}
