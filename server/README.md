# 后端工程

Node.js + TypeScript + Fastify，SQLite 本地持久化，Drizzle 描述全部 schema，版本化 SQL 迁移管理实际数据库约束。生产连接使用 better-sqlite3，身份服务和权限策略可注入临时数据库进行测试。

## 当前实现范围

已实现账号、令牌、滑块、账号状态、权限核心，班级/学期与学生名单，以及测评、批量成绩、版本冲突、本期基础统计和历史只读参照；人工评语、通知设置与一致性教学导出快照也已接入；账号素材库、AI 配置与累计额度管理已接入；实际 AI 调用、素材排版草稿、分析/导入/导出、报告、受控历史迁移及灾备工具已接入。不要将当前开发版本用于正式教学数据。

## 启动

1. 在根目录安装工作区依赖（需要 pnpm 10、Node.js 22.13+）。
2. 复制 `.env.example` 为 `.env`，保持 WEB_ORIGIN 与前端地址一致。非生产环境允许同协议、同端口的 `localhost`、`127.0.0.1`、`[::1]` 本机地址互换；生产环境严格匹配 WEB_ORIGIN。
3. 根目录运行 `pnpm db:migrate`。
4. 根目录运行 `python3 start.py`，或 `pnpm --filter @class-management/server dev`。
5. 本机打开前端页面；数据库尚无管理员时填写手机号、可选昵称，创建后复制系统生成的临时密码。前往登录，完成滑块验证并在首次登录后修改密码。已有管理员时不会重新初始化。

网页首次设置只允许非生产环境的本机连接，并校验来源和防跨站请求头。`NODE_ENV=production` 或远程部署使用 `pnpm admin:init`，交互输入手机号、昵称和非空、非纯数字密码。

管理员忘记密码时，由持有服务器权限的运维人员运行 `pnpm --filter @class-management/server exec tsx --env-file-if-exists=.env src/cli/admin.ts --reset`，交互输入手机号和新密码；该命令撤销所有旧登录，不提供公开恢复入口。

生产使用 HTTPS 和同域反向代理，NODE_ENV=production；服务器启动只检查数据库版本，不能用启动命令清空或重建旧数据。DATABASE_PATH 默认是根目录 `data/class-management.sqlite`，按用户要求与正式附件目录 `data/attachments/` 一起纳入 Git。附件使用账号 UUID 与内容摘要作为路径，不可变文件保留历史版本；上传临时文件 `*.tmp`、备份、迁移资料（含临时登录信息）、SQLite WAL/SHM 文件及本地环境配置继续忽略。数据库与对应附件应在同一次提交中保存；提交数据库前应停服或使用 SQLite 一致快照。自定义 `ATTACHMENT_DIR` 的文件需另外保存，默认规则只跟踪上述目录。Git 中的数据不替代数据库与附件的成对灾备。

## 目录

- `auth/`：scrypt 密码、随机令牌、限流、拼图挑战及票据。
- `policies/`：真实管理员权限及 actor/owner 隔离。
- `routes/`：JSON Schema 校验与 HTTP 响应。
- `services/`：账号操作、事务与白名单响应。
- `db/`：版本化数据库初始化、约束和 Drizzle schema。
- `cli/`：受控迁移、管理员初始化。
- `repositories/`：必须携带 ownerId 的工作区与成绩 SQL 仓储。
- `tests/`：真实内存 SQLite 和 Fastify inject 验证，不启动监听端口。

## 认证与保护

Access Token 一小时，仅存摘要；Refresh Token 七天绝对期限、每次轮换。旧刷新令牌重用会撤销设备登录。禁用、软删除、改密更新 authVersion 并撤销全部设备，已有访问令牌立即失效。

刷新令牌由 HttpOnly Cookie 传输，Web 校验 Origin 和 CSRF 请求头。未知角色/VIP 字段拒绝，不自动丢弃。管理员禁止禁用、删除、降级，由 Service 与 SQLite 约束/触发器共同保护。账号代管不替换真实登录者，身份接口禁止代管头。

密码使用 Node.js 内置 scrypt（N=32768、r=8、p=3），盐为随机 16 字节；不自写密码算法。接口不返回密码哈希。创建或重置的随机初始密码只返回一次，首登只允许改密及退出。

## 验证

安装依赖后运行 `pnpm --filter @class-management/server test`，先构建后执行 Node.js 测试。`security.test.mjs` 可使用 Node.js 24 内置 SQLite 进行独立验证；生产仍使用 better-sqlite3。测试数据均为内存数据库，不操作实际文件。

成绩接口与使用规则见 [服务器成绩与历史参照](../docs/development/server-scores.md)。数据库当前 schema v9；真实用户库尚未自动初始化或迁移。

教学评语与通知契约见 [服务器教学导出](../docs/development/server-teaching-exports.md)。

- [服务器座位表与值日表：方案隔离、保存、软删除与导出](../docs/development/server-classroom-tools.md)

- [服务器素材库：隔离、文件存储、上传下载与一致备份](../docs/development/server-attachments.md)

AI 配置及累计额度见 [服务器 AI](../docs/development/server-ai.md)。保存 Key 前需配置 `AI_ENCRYPTION_KEY`；业务生成及网络适配已接入；真实供应商需配置后实测。

- [导入、分析、打印与业务文档](../docs/development/server-data-tools.md)
- [迁移、Docker 部署及灾备](../docs/development/server-operations.md)
