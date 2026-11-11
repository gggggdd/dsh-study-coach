# 学习教练 · 雨课堂特化版 / Learning Coach for Yuketang

一个把**雨课堂课程与课件**变成「可执行学习计划 + 考点清单 + 间隔重复卡片」的 DeepSeek Harness 插件。

## 功能

### 雨课堂读取（只读）

- **指定课程**：按学期列出 `classroomId` / `courseId`，选择具体课程班级。
- **课堂记录**：读取课程活动时间轴，定位某一节课（`type=14` 的 `coursewareId` 即 `lessonId`）。
- **课件**：读取课件清单与全部幻灯片页面，图片可直接下载；`ykt` 工具可把幻灯片作为图片附件交给模型阅读。
- **回放时间线**：读取老师实际翻过的页（`shownSlideIndexes`），区分「讲过」和「没讲」。
- **章节计划**：读取章节树、完成度、得分与截止时间。
- **课堂思维导图 / 笔记 / 得分构成**：平台已生成的结构化数据一并读取。
- **安全边界**：不签到、不答题、不提交、不发弹幕；只使用用户自己的 sessionid 读取本人有权访问的数据。

### 学习中心

- 左侧栏「学习教练」入口 → 学习中心，含 **复习 / 卡片库 / 学习统计 / 雨课堂** 四个标签页。
- 「雨课堂」页签：登录、按学期浏览课程、看课堂记录、章节计划、课件缩略图。
- **一键 AI 总结**：在课程页每节课右侧点「AI 总结」，或在课时页点「AI 总结本节」。AI 会逐页阅读**该课时全部课件**（每 6 页一批送入视觉模型，最多 3 批并行、提前下载下一批图片，覆盖所有页；读页用模型最低推理强度，最终汇总用 high，遇到限流自动降低并发重试），并结合回放讲过的页、平台思维导图与课堂笔记，生成结构化总结：
  - 核心知识点（重点/掌握/了解分级 + 对应课件页）
  - 考点清单（为什么考、怎么答）
  - 易错点 / 易混点
  - 考前 7 天复习计划
  - 可一键复制 Markdown，或把知识点批量加入复习卡组
- **知识看板**：总结进行时，每读完一批课件，AI 就把新知识点"长"进看板（洞洞板样式，每棵知识树是一块钉在板上的卡片）。树怎么长由 AI 决定：有关联的知识放进同一棵树并尽量往下展开，无关主题另起一棵树，发现两棵树相关时会合并。节点按流式结果逐个出现；点节点可看一句话解释和对应课件页，点页码直接放大该页。看板随总结一起缓存。
- **课件放大**：点击任意课件缩略图进入全屏查看器，支持放大/缩小、适应窗口、上一页/下一页、键盘方向键与 Esc。
- **单页 AI 对话**：放大页右侧内置 AI 聊天，针对当前页提问；支持高亮划线、圈画、橡皮、撤销、清空，标注会随问题一起发给 AI（包含标注区域坐标与透明标注层图片），让 AI 优先解释你圈出的部分。
- **模型自选**：面板顶部「模型」下拉框列出 Harness 已配置的 provider / model，可跟随默认模型或单独为本插件选择；选择结果持久化在插件配置里。AI 总结与单页对话需要支持图片输入的模型。
- 学习计划与考点：也可以复制「分析指令」交给对话中的 DeepSeek，使用 `ykt` 工具重新读取课件后输出计划与考点，再用 `study` 工具沉淀成原子化复习卡片。

### 原有学习能力

- 间隔重复：`again / hard / good / easy` 四档调度，从 10 分钟逐步延长到数周。
- `study` 工具：`add / due / grade / stats / list / update / delete / reset_stats`。
- 输入框下方「学习 · N 张待复习」胶囊；`/study` 命令；中英双语。

## 连接雨课堂

1. 学习中心 → 雨课堂 → 选择区域（雨课堂 / 荷塘 / 长江 / 黄河）。
2. 点「获取二维码」，用微信或雨课堂 App 扫码确认（二维码约 5 分钟有效）。
3. 也可以切到「sessionid / 完整 Cookie 登录」：浏览器登录后 F12 → Network → 任意请求 → 复制 **Cookie 请求头**（至少含 `sessionid`；长江/荷塘等区域通常还需要 `csrftoken`、`university_id`）粘贴。**推荐完整 Cookie**。
4. 登录成功后即可浏览课程；或直接在对话里说「读取雨课堂数据结构课程第 3 讲课件，分析学习计划和考点」。

> `sessionid` 保存在 Harness 的凭据记录中（`credentials` 服务，`study-coach/ykt-session`），不写入插件配置、不显示在对话里，也不会被遥测上报。

## 数据与接口

学习卡片保存在本插件行的 `stateJson` 快照。AI 知识点总结缓存在本机 `~/.dsh-study-coach/summaries.json`（可用环境变量 `DSH_STUDY_COACH_DATA` 改目录），便于下次打开课时直接查看。雨课堂数据按需从官方学生端接口读取，不做持久化缓存。核心接口：

- `GET /v2/api/web/courses/list?identity=2` 课程列表
- `GET /v2/api/web/logs/learn/{classroomId}` 课程活动
- `GET /api/v3/classroom-report/student/lesson-info` 课时信息
- `GET /api/v3/lesson-summary/student` / `.../presentation` 课件与页面
- `GET /api/v3/lesson-summary/replay` 回放时间线
- `GET /c27/online_courseware/schedule/course/progress/` 章节进度
- `GET /api/v3/lesson-summary/query-lesson-mind-map` 思维导图

接口为雨课堂学生端非公开接口，平台改版可能失效；插件会返回可读错误和下一步建议。

## 安装

通过 Harness Plugin Manager 安装本目录（bundle patch 插入 `study-coach` 行），无需构建步骤。开发测试：

```bash
npm test
# 或逐个运行：
node test/host.test.mjs
node test/host-ykt.test.mjs
node test/host-route.test.mjs
node test/host-ai.test.mjs
node test/host-ai-speed.test.mjs
node test/ai.test.mjs
node test/ykt.test.mjs
node test/client.smoke.mjs
```

## 致谢 / Credits

- QR 登录渲染使用 [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)（Kazuhiko Arase，MIT License），已内联进 `client.js`。
- 雨课堂接口契约参考了公开的 [yuketang-mcp](https://github.com/powercess/yuketang-mcp)（MIT）。

## 常见问题

- **面板提示 `HTTP 404` / 本地桥接未加载**：先刷新 DSH 页面；若仍然出现，确认插件已启用后重启一次 DSH（Host 端路由需要随插件重新挂载）。
- **二维码扫了没反应**：确认选择的区域与账号一致（四个区域会话互不通用），二维码约 5 分钟有效，过期后点「刷新二维码」。
- **课程列表 HTTP 500**：常见原因是 Cookie 缺少 `csrftoken` / `university_id`（尤其是长江/荷塘区域）。请改用完整 Cookie 登录。
- **课程/课件返回 401 或 50000**：sessionid 已过期，重新扫码或重新粘贴完整 Cookie。
- **课件页图片打不开**：课件图片本身若在雨课堂 CDN 上过期/不可见，面板会给出图片 URL；可在浏览器中打开对应课程页面确认权限。
