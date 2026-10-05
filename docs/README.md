# 文档导航

## 开发与验证

- [DOM 打印验证记录](./development/dom-print-validation.md)：真实文字与表格预览、SVG 报告图表、通知素材对照及实际导出验收。

- [PC 班务工具设计与实现](./development/pc-classroom-tools-design.md)：名单打印、座位轮换、值日自动分配、批量报告、奖状编辑与考试分析打印。

- [V5.0 班级与学期工作区](./development/v5-class-workspaces.md)：多班、升班、历史参照、数据迁移与备份说明。

- [2026-10-03 项目重构实施记录](./development/refactor-2026-10-03.md)：模块拆分、命名整理、引用清理及该次验证结果。
- [测试说明](./development/testing.md)：运行命令、测试目录约定和主要覆盖范围。
- [备份、满分与 AI 识图校验报告](./reports/backup-score-ai-validation.md)：历史专项验证，不代表当前全量测试结果。

## 项目展示与设计

- [项目截图](./screenshots/)：根目录 README 使用的截图。
- [成绩通知素材说明](./design/成绩通知素材/README.md)：应用素材位置、尺寸、复用方式及制作参考。

## 论文

- 论文资料仅保留在本地 `docs/论文/`，已加入 Git 忽略规则，不随项目提交。本地导航为 `docs/论文/README.md`。

## 整理说明

2026-10-03 将根目录的重构、专项测试报告归入本目录，并将测试详细说明集中到开发文档。论文按主题整理，保留稿件原名和版本信息。

成绩通知的 18 张应用素材重复副本已清理，正式文件保留在 `src/assets/score-notice/`；两张未接入应用的制作参考图仍保留。论文中两张重复插图各保留一份，相关 Markdown 图片链接已同步调整。

项目入口仍为根目录的 [README](../README.md)，编码代理指南仍为 [AGENTS.md](../AGENTS.md)。
