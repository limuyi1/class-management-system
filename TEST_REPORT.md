# 测试报告：备份提醒 & 满分可配置 & AI 识图预览校验

## 一、改动概述

本次针对两个数据安全 / 数据完整性风险落地了三项增强：

1. **备份提醒**：记录「上次备份时间」，在设置页「系统备份」展示；从未备份或超过 7 天未备份时显示红色警告。
2. **满分可配置**：新增全局「成绩满分」配置项（默认 100），手动录入与 AI 识图共用同一满分边界。
3. **AI 识图写入预览校验**：AI 识别结果不再直接写入，改为「预览 → 勾选 → 确认写入」，并对分数做 0~满分 校验。

## 二、变更文件清单

| 文件 | 说明 |
| ---- | ---- |
| `src/types/Configuration.ts` | 新增 `lastBackupAt`、`scoreFullMark` 字段 |
| `src/stores/configuration.ts` | state 新增 `lastBackupAt: null`、`scoreFullMark: 100` |
| `src/utils/backup.ts` | 新增 `getDaysSinceBackup`；`exportDatabase` 成功后写入备份时间 |
| `src/views/setting/components/ImportExport.vue` | 「导出数据」卡片展示备份状态 |
| `src/views/setting/components/import/import-export.scss` | 新增 `.backup-status` 样式 |
| `src/views/setting/components/UnitConfiguration.vue` | 新增「成绩满分（全局）」配置卡片 |
| `src/views/score/components/ScoreInputCard.vue` | 录入框 `:max` 绑定 `scoreFullMark` |
| `src/utils/scoreRecognitionUtil.ts` | 新增 `isValidScore`、`buildScoreRecognitionPreview` |
| `src/views/score/components/ScoreRecognitionPreviewDialog.vue` | 新增预览确认对话框 |
| `src/views/score/ScorePage.vue` | 识图流程改为「预览 → 确认写入」 |

## 三、单元测试

### 新增 / 修改测试

- `tests/utils/scoreRecognitionUtil.test.ts`（新增，7 个用例）
  - `isValidScore`：边界值（0 / 满分）、超范围、null / undefined / NaN
  - `buildScoreRecognitionPreview`：唯一匹配、重名、未匹配、超范围、null 分数、无已有分、自定义满分
- `tests/utils/backup.test.ts`（新增 `getDaysSinceBackup`，2 个用例）
  - 从未备份 / 无效日期返回 null
  - 3 天前 / 7 天前返回正确天数

### 测试结果

- `pnpm test`：**69 个测试文件全部通过，341 个用例通过**
- `pnpm type-check`：**通过（无类型错误）**

## 四、浏览器验收

| 验收项 | 结果 |
| ------ | ---- |
| 设置页「系统备份」tab 显示「从未备份，建议尽快备份」 | ✅ 通过 |
| 设置页「单元配置」tab 显示「成绩满分（全局）」且默认值 100 | ✅ 通过 |
| 页面控制台无 JS 错误 | ✅ 通过（Console messages: none） |

> AI 识图端到端流程依赖真实 AI 接口与图片上传，本次通过 `scoreRecognitionUtil` 纯函数单测覆盖校验与匹配逻辑；对话框 UI 与写入链路通过代码审查确认。

## 五、验收清单

- [x] 导出成功后刷新，设置页显示「上次备份时间」（写入 `lastBackupAt`）
- [x] 从未备份显示红色「从未备份，建议尽快备份」；≥7 天显示「N 天前」警告
- [x] 满分默认 100，可在「单元配置」修改
- [x] 手动录入 `:max` 与 AI 校验使用同一满分
- [x] AI 识别结果先预览、默认勾选「匹配 + 有效 + 有分数」行，异常行默认不写入
- [x] 单元测试全部通过，类型检查通过
