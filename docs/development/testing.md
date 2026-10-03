# 测试说明

项目的 `tests/` 目录包含班务管理系统的全部单元测试与组件测试。测试框架为 **Vitest**，组件测试使用 **@vue/test-utils**，DOM 环境使用 **happy-dom**。

## 运行命令

| 命令                 | 说明                                 |
| -------------------- | ------------------------------------ |
| `pnpm test`          | 运行全部测试（run 模式，一次性执行） |
| `pnpm test:watch`    | 监听模式，文件变更时自动重跑相关测试 |
| `pnpm test:coverage` | 运行测试并生成覆盖率报告             |

## 目录结构与命名约定

```
tests/
├── ai/           # AI 相关功能（评语生成服务）
├── components/   # 共享/全局组件测试
├── constants/    # 共享常量测试
├── hooks/        # 组合式函数（use*）测试
├── plugins/      # Vue 插件测试（持久化等）
├── router/       # 路由守卫测试
├── scripts/      # 独立迁移脚本测试
├── stores/       # Pinia store 测试
├── utils/        # 工具模块（*Util.ts）测试
├── views/        # 页面级 hook 与视图测试（evaluation/ overview/ tools/）
└── setup.ts      # Vitest 全局 setup（全局 stub 注册）
```

约定：

- 测试文件命名为 `*.test.ts`，与被测源文件同名（如 `src/utils/xlsxUtil.ts` → `tests/utils/xlsxUtil.test.ts`）。
- 从被测代码导入时使用相对于测试文件的 `src/` 路径，例如 `tests/utils/` 中使用 `../../src/...`；嵌套目录按实际层级调整。
- 测试组织使用 `describe` / `it`，每组 `describe` 对应一个被测模块或函数。

## 主要测试文件清单

以下为主要模块的覆盖说明，完整清单以 `tests/**/*.test.ts` 为准。

### ai/

| 测试文件            | 被测模块           | 主要覆盖点                                                                                               |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `aiService.test.ts` | `src/ai/aiService` | 评语生成提示词组装（分数剥离、空标签处理、经典表达频率控制）、AI JSON 响应解析（批量润色、标签分类生成） |

### components/

| 测试文件                              | 被测组件                      | 主要覆盖点                                                          |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| `CommentSourceBar.test.ts`            | `CommentSourceBar`            | 评语来源切换入口的合并显示、Excel 来源状态、禁止切换到空系统来源    |
| `CommentExcelImportDialog.test.ts`    | `CommentExcelImportDialog`    | Excel 解析完成前禁用导入确认                                        |
| `EvaluationWorkspaceControls.test.ts` | `EvaluationWorkspaceControls` | 预览设置折叠、批量与导出操作、AI 助手/保存操作、润色模式切换        |
| `DutyRosterExportDialog.test.ts`      | `DutyRosterExportDialog`      | 导出对话框挂载到 body 浮层                                          |
| `DutyRosterExportPreview.test.ts`     | `DutyRosterExportPreview`     | A4 横向纸张渲染、周行渲染、内容缩放、标题与备注隐藏                 |
| `DutyScheduleMatrix.test.ts`          | `DutyScheduleMatrix`          | 工作日/人数/负责人标记渲染、周模式编辑、双击编辑岗位名              |
| `PageHeader.test.ts`                  | `PageHeader`                  | 标题/副标题/插槽渲染、CSS 类名、长文本处理                          |
| `RootRedirectPage.test.ts`            | `RootRedirectPage`            | 无学生数据时重定向到工具页，有数据时重定向到概览页                  |
| `ScoreNoticeControlPanel.test.ts`     | `ScoreNoticeControlPanel`     | 步骤流程控制（导入→设置→评语工作区）、草稿保存、批量填充、导出确认  |
| `ScoreNoticePreview.test.ts`          | `ScoreNoticePreview`          | 成绩通知单渲染（科目/等级/评语）、原始分显示、按科目数自适应列数    |
| `SeatingChartCanvas.test.ts`          | `SeatingChartCanvas`          | 讲台与坐标芯片渲染、过道、列翻转                                    |
| `SeatingChartExportPreview.test.ts`   | `SeatingChartExportPreview`   | 静态座位表预览（标题/讲台/过道/特殊座位）、纸张画布、方向与纸张大小 |
| `ThresholdStudents.test.ts`           | `ThresholdStudents`           | 阈值学生列表与人数统计显示                                          |
| `UnassignedStudentPanel.test.ts`      | `UnassignedStudentPanel`      | 数据源控制、学生卡片与选中事件、完成态/无名单态、搜索空态           |

### constants/

| 测试文件        | 被测模块        | 主要覆盖点                                                                                       |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `index.test.ts` | `src/constants` | 学生字段 prop 键（姓名/学生ID）唯一事实来源、数据库名称与主记录 ID、数据库表枚举到持久化表名映射 |

### hooks/

| 测试文件                              | 被测模块                                | 主要覆盖点                                                                                                           |
| ------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `useEvaluationInput.test.ts`          | `src/hooks/useEvaluationInput`          | 编辑标签跳转独立学生信息页、编辑临时 Excel 行不写入系统 store 且不跳转                                               |
| `useProgress.test.ts`                 | `src/hooks/useProgress`                 | 完成进度百分比与计数（空数据、全填、部分填、空字符串/undefined 视为未完成、0 视为已完成）                            |
| `useScoreStatistics.test.ts`          | `src/hooks/useScoreStatistics`          | 分数统计、分数段区间划分与最高分排除、低于阈值筛选、阈值联动、并列计数、字符串分数                                   |
| `useTabQuerySync.test.ts`             | `src/hooks/useTabQuerySync`             | 标签页与路由 query 双向同步、忽略遗留 edit-tags 参数、合法标签集合响应式更新                                         |
| `useEnterUp.test.ts`                  | `src/hooks/useEnterUp`                  | 全局回车监听（name 匹配、输入法组合过滤、节流/防抖、回调异常不影响后续触发、卸载移除监听）                           |
| `useExcelPreviewImport.test.ts`       | `src/hooks/useExcelPreviewImport`       | Excel 预览状态层（el-upload/原生 File 双入口、空文件与解析失败提示、表头行切换派生数据、状态重置）                   |
| `useScoreDistributionActions.test.ts` | `src/hooks/useScoreDistributionActions` | 成绩分布复制与导出（剪贴板文本组装、复制失败提示、空列表提示、含分数/仅姓名导出模板、遮罩与离屏容器清理）            |
| `useStudentDataImport.test.ts`        | `src/hooks/useStudentDataImport`        | 三类 Excel 导入编排（首次导入写 store、成绩列冲突检测与跳过、增量成绩/评语导入、覆盖二次确认与取消、导入后路由跳转） |

### plugins/

| 测试文件               | 被测模块                   | 主要覆盖点                                                                                                                                |
| ---------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `persistDexie.test.ts` | `src/plugins/persistDexie` | Dexie 持久化插件：加载/保存、剥离 id 字段、旧版 aiConfig 合并默认提示词、加载/保存错误日志、记录删除时重置状态、无 studentId 遗留数据兼容 |

### router/

| 测试文件               | 被测模块                          | 主要覆盖点                                                                           |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| `router-guard.test.ts` | `src/router`（`createDataGuard`） | 工具页/设置页跳过数据检查、无数据时首页/学生信息页重定向到工具页、评语工具免数据检查 |

### scripts/

| 测试文件                                  | 被测模块                                      | 主要覆盖点                                                                                                                                                  |
| ----------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add-student-ids-to-dexie-backup.test.ts` | `scripts/add-student-ids-to-dexie-backup.mjs` | 迁移脚本：为缺失 studentId 的学生补 ID、保留已有 ID、同步 app_preferences 引用、重复 ID 抛错                                                                |
| `convert-dexie-backup.test.ts`            | `scripts/convert-dexie-backup.mjs`            | 迁移脚本：备份格式校验、dataSource→student_dataset 与 setting→score_settings 字段迁移、元数据清理与 updatedAt 补充、未知表跳过、键值对行兼容、tables 元信息 |

### stores/

| 测试文件                    | 被测 store                 | 主要覆盖点                                                                                                     |
| --------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ai-config.test.ts`         | `useAIConfigStore`         | 单个/全部提示词重置为默认值                                                                                    |
| `data-source.test.ts`       | `useDataSourceStore`       | 数据初始化、按 ID 查找学生、enabledData 过滤、及格/优秀/低分率等统计、初始化就绪等待                           |
| `duty-roster.test.ts`       | `useDutyRosterStore`       | 值日表分配（移动不复制、负责人唯一、删除岗位回退未分配、日/周模式切换、区块排序、周行管理）                    |
| `seating-chart.test.ts`     | `useSeatingChartStore`     | 座位表数据源（系统/Excel 名单）、切换来源清空分配、首列方向、创建态                                            |
| `setting.test.ts`           | `useSettingStore`          | 预设标签分类与标签初始化、每个实例使用全新预设数组                                                             |
| `configuration.test.ts`     | `useConfigurationStore`    | 24 个默认配置字段、字体大小批量同步（不影响其他字段）、页面类型列表顺序                                        |
| `overview-analysis.test.ts` | `useOverviewAnalysisStore` | 分析文本与 ISO 时间戳写入/覆盖/清空、初始空状态                                                                |
| `score-notice.test.ts`      | `useScoreNoticeStore`      | 默认状态与导入应用、学生选中、评语校验三分支（通过/需复核）、状态计数 getter、科目规则重算、重置通知           |
| `theme.test.ts`             | `useThemeStore`            | 默认主题初始化（watcher 立即应用）、themeConfig 查表、setTheme 后 CSS 变量写入、resetTheme 恢复默认            |
| `tools.test.ts`             | `useToolsStore`            | 纸张布局默认设置、不同实例之间状态隔离                                                                         |
| `wrong-book.test.ts`        | `useWrongBookStore`        | 文件夹/题目增删改查、default 删除保护与递归级联、收藏回迁、folderTree 递归排序、initFolders 兜底、题目类型管理 |

### utils/

utils 下文件最多，按功能分类如下。

**Excel 导入导出与名单解析类**

| 测试文件                            | 主要覆盖点                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `xlsxUtil.test.ts`                  | 导入数据构建（表头行选择）、空表头回退命名                                                  |
| `commentImportUtil.test.ts`         | 评语 Excel 导入（默认仅填空、覆盖但忽略空白单元格、保持学生表顺序、覆盖确认计数、跳过重名） |
| `scoreImportUtil.test.ts`           | 成绩导入（无分数列导入、按姓名新增/覆盖/跳过冲突列、重名与歧义名处理、分数解析）            |
| `initialStudentImportUtil.test.ts`  | 初次名单导入（姓名/选中分数/非空评语、纯名单导入）                                          |
| `commentWorkspaceExcelUtil.test.ts` | 评语工作区 Excel 导入（临时标签切分、重名独立临时行、覆盖/新增评语列）                      |
| `evaluationTextExcelUtil.test.ts`   | 评语文本 Excel 导出（表头与数据构建并委托 exportExcel）                                     |
| `scoreNoticeImportUtil.test.ts`     | 成绩通知单导入（已有等级直接导入、按科默认值换算、保持 Excel 行序、跳过重名并报告非法值）   |
| `scoreRecognitionUtil.test.ts`      | 成绩识别（0~满分校验、自定义满分、姓名匹配预览、重名/未知姓名/越界分标记）                  |
| `nameListCompare.test.ts`           | 名单比对（姓名清洗、粘贴解析、按基准顺序构建对比行、表头推荐）                              |

**PDF 类**

| 测试文件                           | 主要覆盖点                                                          |
| ---------------------------------- | ------------------------------------------------------------------- |
| `pdfUtil.test.ts`                  | DOM 元素导出 PDF、渲染失败返回 success:false 与错误                 |
| `evaluationPdfLayoutUtil.test.ts`  | 评语 PDF 版面计算（纸张尺寸、行列容量、对齐偏移、分页、评语格坐标） |
| `evaluationTextPdfUtil.test.ts`    | 评语文本 PDF 导出（与预览一致的自适应字号）                         |
| `evaluationTextLayoutUtil.test.ts` | 评语格布局（字号自适应、工具提示开关、最小字号溢出回退）            |
| `seatingChartImagePdfUtil.test.ts` | 基于 PNG 图片的座位表 PDF 导出                                      |
| `pageSizeInPixelUtil.test.ts`      | 纸张尺寸换算（横纵向交换、96 DPI 下毫米转像素）                     |

**座位表类**

| 测试文件                             | 主要覆盖点                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `seatingChartUtil.test.ts`           | 座位坐标与调整尺寸、非法绑定/过道校验、随机分配（仅可用容量、列翻转、特殊座位固定、补充模式） |
| `seatingChartStudentUtil.test.ts`    | 名单与座位合并（临时标签切分、重复姓名独立行、覆盖/新增评语列）                               |
| `seatingChartExportUtil.test.ts`     | 座位表导出（文件名清洗、本地导出日期格式）                                                    |
| `seatingChartPageLayoutUtil.test.ts` | 座位表纸张版面（纸张尺寸、方向推荐、缩放上限、标题区域回收）                                  |

**值日表类**

| 测试文件                           | 主要覆盖点                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `dutyRosterUtil.test.ts`           | 值日表数据处理（每日/每周模式、无效与重复学生清理、负责人移除、旧措辞与遗留周分配迁移） |
| `dutyRosterStudentUtil.test.ts`    | 值日表名单构建（系统/Excel 名单转换、来源解析、无值日表返回空数组）                     |
| `dutyRosterExportUtil.test.ts`     | 值日表导出（文件名清洗、导出日期格式）                                                  |
| `dutyRosterPageLayoutUtil.test.ts` | 值日表页面布局（横向纸张与每日行列数、自定义周行与缩放、A3 可读性估算）                 |

**成绩通知类**

| 测试文件                         | 主要覆盖点                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `scoreNoticeCommentUtil.test.ts` | 成绩通知评语校验（禁止泄露具体分数/排名、180-320 字要求、段落处理、无 AI 时构建合格模板评语） |
| `scoreNoticeGradeUtil.test.ts`   | 等级归一化、百分制/五十分制分数边界换算、数据来源与科目规则推荐                               |
| `scoreNoticeImageUtil.test.ts`   | 成绩通知单图片（文件名清洗、下载与剪贴板复制、DOM 渲染为 PNG Blob）                           |

**评语类**

| 测试文件                              | 主要覆盖点                                                     |
| ------------------------------------- | -------------------------------------------------------------- |
| `commentLengthUtil.test.ts`           | 评语字数统计（忽略空白、最小/最大字数校验、末尾空白处理）      |
| `commentPolishUtil.test.ts`           | 评语润色（仅润色已有评语、只应用非空润色结果、不填充空白原文） |
| `evaluationHandwriteFontUtil.test.ts` | 手写字体渲染字符覆盖判断（忽略空白与不可见格式字符）           |

**统计/概览类**

| 测试文件                       | 主要覆盖点                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `scoreStatisticsUtil.test.ts`  | 平均分、及格率、优秀率、优良率、低分率、综合评分率计算                                        |
| `overviewDashboard.test.ts`    | 概览面板数据（总览、重点关注分组与推荐学生、单/多学生趋势摘要、难度调整、波动方向与标签抑制） |
| `studentReportUtil.test.ts`    | 学生报告数据（空分数单元保留并排除出汇总统计）                                                |
| `studentInfoTableUtil.test.ts` | 学生信息表（可见标签摘要构建与渲染数量限制、无缓存标签时空摘要）                              |
| `studentUtil.test.ts`          | 学生身份工具（UUID 生成、ID 唯一性校验、重名按 ID 查找、无 ID 遗留数据处理、标签提取）        |
| `tagCategoryUtil.test.ts`      | 标签分类（拼音 prop 生成、空/重复标签校验、prop 冲突加后缀、批量去重）                        |

**备份/迁移类**

| 测试文件                          | 主要覆盖点                                           |
| --------------------------------- | ---------------------------------------------------- |
| `databaseBackupUtil.test.ts`      | 数据库备份导入导出（旧备份版本兼容、距上次备份天数） |
| `persistDexieImportState.test.ts` | 持久化导入状态（默认非导入、设置/重置导入状态）      |
| `settingMigrationUtil.test.ts`    | 设置迁移（为缺失 disabled 字段补 false、保留已有值） |

**通用工具类**

| 测试文件                    | 主要覆盖点                                                                      |
| --------------------------- | ------------------------------------------------------------------------------- |
| `commonUtil.test.ts`        | 数组分组、延时                                                                  |
| `fileUtil.test.ts`          | Base64 转换、字节大小、文件大小格式化、图片压缩体积估算                         |
| `loadingUtil.test.ts`       | 全局加载遮罩（创建/关闭/文本更新、runWithLoading 自动启停与异常兜底、单例重置） |
| `zipUtil.test.ts`           | 合法 zip 压缩包构建（UTF-8 文件名）                                             |
| `katexUtil.test.ts`         | KaTeX/Markdown 渲染（行内/块级公式、公式空白、混合内容）                        |
| `paperLayoutCanvas.test.ts` | 纸张画布（图片分页排版、拖拽边界、zIndex、页面局部坐标、满页填充）              |

### views/

| 测试文件                                        | 被测模块                     | 主要覆盖点                                                                                            |
| ----------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `evaluation/EvaluationCard.test.ts`             | `EvaluationCard`             | 自适应评语预览（轻微溢出缩小字号、最小字号仍溢出时启用工具提示）                                      |
| `evaluation/useEvaluationBatchComments.test.ts` | `useEvaluationBatchComments` | 批量评语生成（标签格式化、经典表达计数、AI 未配置警告、仅填空、按 ID 应用乱序结果、字数过滤、润色）   |
| `evaluation/useEvaluationHandwriteFont.test.ts` | `useEvaluationHandwriteFont` | 手写字体选择（文件名缩短、隐藏输入触发、保存与恢复）                                                  |
| `evaluation/useEvaluationTextPdfExport.test.ts` | `useEvaluationTextPdfExport` | 评语 PDF/Excel 导出（无学生警告、字形确认、超长截断警告、Excel 导出与失败提示）                       |
| `overview/dashboard-metrics.test.ts`            | 概览指标 hook                | 难度平移判断、正常基线、空分数单位保留                                                                |
| `overview/trend-chart.test.ts`                  | 趋势图组件                   | 工具提示格式化、平均线标签防重叠、单/多学生对比图表配置                                               |
| `tools/ToolsPage.test.ts`                       | `ToolsPage`                  | 工具按教学场景分组、从卡片打开工具                                                                    |
| `tools/usePaperLayoutDraft.test.ts`             | `usePaperLayoutDraft`        | 纸张布局草稿（空画布保存警告、序列化与元数据、打开时排序与字段归一化）                                |
| `tools/usePaperLayoutCanvas.test.ts`            | `usePaperLayoutCanvas`       | 纸张画布交互（像素转毫米、添加附件、移动/缩放、删除选中项、缩放范围）                                 |
| `evaluation/useEvaluationCommentSource.test.ts` | `useEvaluationCommentSource` | 评语数据源切换（默认系统源、Excel 载入/导出、未导出修改拦截源切换、浏览器刷新拦截与路由离开守卫）     |
| `overview/useOverviewAnalysis.test.ts`          | `useOverviewAnalysis`        | AI 学情分析生成（未配置短路、提示词载荷组装、成功写入 store、失败提示、loading 状态）                 |
| `overview/useOverviewDashboard.test.ts`         | `useOverviewDashboard`       | 总览页状态（初始化自动选中、失效回退、对比人数截断、单人聚焦、超限警告、看板数据构建）                |
| `seating-chart/useSeatingChartViewport.test.ts` | `useSeatingChartViewport`    | 座位表视口缩放（自然尺寸公式、0.95 可读性下限钳制、空视口/零行列回退、手动刷新、ResizeObserver 清理） |
| `tools/attachmentService.test.ts`               | `attachmentService`          | 素材服务（排序读取、图片过滤与 PNG 直通、重名时间戳、sortOrder 续接、裁剪/旋转写回、object URL）      |
| `tools/paperLayoutDraftService.test.ts`         | `paperLayoutDraftService`    | 试卷草稿存取（倒序读取、新建 ID/时间戳/设置浅拷贝、更新保留创建时间、删除）                           |
| `tools/paperLayoutExportService.test.ts`        | `paperLayoutExportService`   | 试卷 PDF 导出（毫米转 pt 尺寸换算、同 ID 图片只拉取一次、空页面列表输出空白 PDF）                     |

## 测试编写约定

- **文件命名**：与被测源文件同名，后缀 `.test.ts`（如 `src/utils/xlsxUtil.ts` → `tests/utils/xlsxUtil.test.ts`）；按测试文件所在层级相对导入被测代码。
- **describe 组织**：每个 `describe` 对应一个被测模块（工具函数、store、组件或 hook），组件测试的 `describe` 名称与组件名一致；多个入口函数可在一个文件中用多个 `describe` 分组（如 `fileUtil.test.ts` 按函数分组）。
- **mock 常用手法**：
  - `vi.mock('模块路径', factory)` 替换第三方或内部依赖（如 mock `dexie`、`vue-router`）；
  - `vi.hoisted(() => ({ fn: vi.fn() }))` 提前创建 mock 函数，供 `vi.mock` 工厂与测试用例共享引用；
  - `vi.fn()` / `vi.spyOn(console, 'error').mockImplementation(() => {})` 断言调用或抑制噪音日志，并在用完后 `mockRestore()`；
  - `vi.useFakeTimers()` 用于依赖真实定时器的场景（如 `delay`）；
  - `vi.clearAllMocks()` / 手动重置 mock 表状态放在 `beforeEach` 中保证用例隔离。
- **组件测试**：使用 `@vue/test-utils` 的 `mount`；Pinia 通过 `setActivePinia(createPinia())` 建立隔离实例；需要挂载 hook 时用 `defineComponent` 构造最小宿主组件并在 `setup` 中返回 hook 结果。
- **全局 setup**：`tests/setup.ts` 已注册 `font-awesome-icon` 等全局 stub，组件测试无需重复配置。
- **注释**：测试文件顶部用 JSDoc 说明被测模块与覆盖范围，每个 `describe` 上方用行内注释说明该组目标；仅在测试意图不明显处补充 `//` 注释。

## 重构回归检查

- `components/ScoreNoticePreview.test.ts`：保留原有科目、等级、分数长度和布局用例，补充导出根节点、密度边界与长评语切换。
- `components/DutyAssignmentCell.test.ts`：验证组长展示、拖拽目标与右键菜单事件。
- `views/seating-chart/useSeatingChartWorkflow.test.ts`：验证来源切换取消、外部名单删除后的共享状态清理，以及快捷键监听卸载。

## 验证记录

最近一次重构的全量验证结果见 [2026-10-03 重构实施记录](./refactor-2026-10-03.md)。历史专项结果见 [备份、满分与 AI 识图校验报告](../reports/backup-score-ai-validation.md)。
