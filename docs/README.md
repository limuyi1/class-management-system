# 文档导航

## 开发与验证

- [服务器教学导出](./development/server-teaching-exports.md)：人工评语、通知设置、快照导出与打印说明。
- [服务器成绩与历史参照](./development/server-scores.md)：录分、测评、空值、批量冲突、历史排名和接口契约。
- [服务器班级、学期与名单](./development/server-workspaces.md)：页面操作、身份关系、接口范围、幂等与版本冲突。
- [前后端分离实施记录](./development/node-sqlite-implementation.md)：当前交付范围、验证结果和真实环境验收边界。

- [Node.js + SQLite 前后端分离改造方案](./development/node-sqlite-migration-plan.md)：已审核第四版方案，包含账号软删除、顶部账号代管、统一令牌认证、滑块、ui/server 工程、自动释放端口的一键启动、运维灾备及验收标准。

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

成绩通知的 18 张应用素材重复副本已清理，正式文件保留在 `ui/src/assets/score-notice/`；两张未接入应用的制作参考图仍保留。论文中两张重复插图各保留一份，相关 Markdown 图片链接已同步调整。

项目入口仍为根目录的 [README](../README.md)，编码代理指南仍为 [AGENTS.md](../AGENTS.md)。

- [服务器座位表与值日表：方案隔离、保存、软删除与导出](./development/server-classroom-tools.md)

- [服务器素材库：隔离、文件存储、上传下载与一致备份](./development/server-attachments.md)

- [服务器 AI 配置与累计额度](./development/server-ai.md)
- [前后端职责与导出调整](./development/frontend-backend-responsibilities.md)

- [服务器数据工具、学习报告与打印](./development/server-data-tools.md)
- [服务器离线迁移、灾备与部署](./development/server-operations.md)
