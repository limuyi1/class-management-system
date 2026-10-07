# 前端工程

现有 Vue 3 应用已整体迁至本目录，源码在 `src/`，测试在 `tests/`，输出为 `dist/`。

根目录使用 `pnpm --filter @class-management/ui build`、`type-check`、`test`、`lint` 执行对应任务。

默认入口是服务器模式：先恢复登录或显示手机号/密码/滑块登录页，再进入班级与学生、个人设置、登录设备与管理员账号管理。服务器模式不会加载旧 Dexie 教学数据，防止不同账号共享浏览器本地名单。班级学期与学生名单已接入；顶部账号代管需要管理员在个人设置中开启资格，切换只影响业务数据。成绩与历史参照已接入，支持测评配置、本列批量录分、分页、本期基础统计和只读历史列；人工评语、通知单与基础教学导出已接入；其余工具仍待接入。操作说明见 [服务器成绩与历史参照](../docs/development/server-scores.md)。

仅在迁移前兼容验收时，可在本地 `.env` 显式设置 `VITE_STORAGE_MODE=legacy` 打开原本地应用；该设置不可用于正式服务器部署。旧本地版功能暂保留用于迁移验证，账号级备份/恢复/清空不会进入最终服务器入口。

开发端口沿用 5173，默认监听 127.0.0.1，`/api` 由 Vite 转发到后端。更改端口时同步调整 server WEB_ORIGIN、ui VITE_API_TARGET，避免 Cookie 与 Origin 校验失败。

评语、通知设置、Excel 与通知 PNG/PDF/ZIP 操作见 [服务器教学导出](../docs/development/server-teaching-exports.md)。通知每批最多 50 人，不读取旧 Dexie 业务记录。

- [服务器座位表与值日表：方案隔离、保存、软删除与导出](../docs/development/server-classroom-tools.md)

- [服务器素材库：隔离、文件存储、上传下载与一致备份](../docs/development/server-attachments.md)
