# 迁移、部署与成对灾备

2026-10-07。下面命令由运维在审核环境后运行；代码验收没有启动真实服务、写真实教学库、迁移用户备份或调用付费模型。

## 旧版迁移

先在旧本地版导出 V4/V5 Dexie 备份，停止编辑；准备已有服务器账号，目标工作区、素材和业务文档必须全部为空。迁移不创建账号、不导入登录/角色/VIP/Key、不清空或回写浏览器数据，也不迁移停用错题本。

```bash
# 根目录，默认仅预览、SQL 全部回滚，附件验证使用临时目录
pnpm import:legacy --file /absolute/path/backup.dexie --owner 目标账号UUID
# 成对备份服务器数据、停止所有 API 后，再审核预览并提交
pnpm import:legacy --file /absolute/path/backup.dexie --owner 目标账号UUID --commit --services-stopped
```

支持 Dexie 分块行和 Typeson 容器；V4 单工作区转为默认班级/历史学期，V5 目录和快照保持班级、时间及学期关系。长期学生 ID 保持或确定性映射，不按姓名合并；成绩零/空、测评满分、标签、通知、座位/值日及试卷图片快照均转换。旧版从外部 Excel 导入的通知具有独立名单和成绩，原稿存入按学期隔离的历史成绩通知档案；不会因无法映射本期测评而丢弃或把旧分数混入本期。目标非空、缺快照、重复身份、损坏图片/分数或跨班参照拒绝，SQL 整批回滚。文件最大 200 MB；附件 8 MB、2000 万像素及累计 512 MB 限制。报告返回映射和警告供核对。

运维 CLI 提交前再次校验，写入失败只清理本次新建目标附件目录。禁止用非空目标覆盖迁移，不提供整账号恢复/清空按钮。迁移后应核对班级、学期、人数、测评、零分、历史排名、工具方案和打印草稿，再启用编辑。旧模板中引用的历史外部素材/字体及特殊版式仍需逐项核对；不要据自动测试推定所有用户备份都能无差异导入。

## 离线成对备份和恢复

SQLite 和附件必须成对备份；不能仅复制仍有 WAL 的主库文件。`scripts/maintenance.py` 使用 SQLite Online Backup、复制不可变附件、校验数据库完整性/外键及所有历史附件大小/摘要，再原子发布备份目录。拒绝符号链接和重叠路径。AI_ENCRYPTION_KEY 或自动生成的 `.ai-encryption-key` 文件不放进业务备份，须独立保管。

```bash
# 服务已经停止；路径必须对应当前配置，备份目录不能位于源附件树内
python3 scripts/maintenance.py backup --database /absolute/data/database.sqlite --attachments /absolute/data/attachments --directory /absolute/backups/2026-10-07 --services-stopped
python3 scripts/maintenance.py verify --directory /absolute/backups/2026-10-07
python3 scripts/maintenance.py restore --database /absolute/data/database.sqlite --attachments /absolute/data/attachments --directory /absolute/backups/2026-10-07 --services-stopped
```

恢复先验证来源，自动保留目标当前成对回退副本和旧附件目录，再替换数据库/附件；旧 WAL/SHM 不带给新库。失败保留证据，不自动删除历史备份。恢复后检查 schema，使用对应程序版本和原 AI 主密钥，再启动。定期在临时环境演练，不能将源备份直接当作可覆盖生产的指令。

## Docker 部署

`deploy/Dockerfile` 构建 ui/server，`deploy/compose.yaml` 仅一个 API 写实例，Caddy 提供同域 HTTPS，SQLite 与附件位于持久卷 `/data`。先复制 `deploy/.env.example` 为 `deploy/.env`，填写域名和 WEB_ORIGIN。AI 主密钥留空时首次启动自动生成 `/data/.ai-encryption-key` 并在持久卷中复用；须单独备份该文件，恢复已有数据库时使用原主密钥。

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml build
# 首次或升级：先停 API，并保存成对备份
# 迁移仅由显式命令执行，启动不自动清库
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm api node dist/cli/migrate.js
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm api node dist/cli/admin.js
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d
```

持久卷不进入 Git，不使用多副本扩容 SQLite。Compose 将 Caddy 固定为 172.30.70.2，API 仅信任此代理；本地默认不信任转发头。如网段冲突，须同时修改网络及 TRUST_PROXY。Caddy 默认丢弃客户端伪造的转发地址，见 [官方转发头说明](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults)。禁止将 TRUST_PROXY 配成不受控来源。域名解析、证书、卷权限、真实模型和 Windows 启动效果须在目标环境核对；仓库代码测试不代表已经部署。

## Schema 和验证

当前 schema v9：SQL 迁移是唯一执行来源，完整 Drizzle 表描述位于 `server/src/db/schema/`。修改 SQL 后可运行 `python3 scripts/generate_drizzle_schema.py` 在内存库生成描述，随后 Prettier 和 schema 一致性测试；该工具不操作实际用户库。

基础检查按模块运行；交付前统一运行根 `pnpm test`、`pnpm build`、`pnpm lint`，以及 Python 启动/灾备模拟测试。自动化验收与真实浏览器、部署、数据迁移验收分别记录。
