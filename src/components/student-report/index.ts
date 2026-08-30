/**
 * 学习报告相关组件的统一出口。
 *
 * 供外部通过单一路径导入报告弹窗、预览卡片与侧边栏，避免重复的深层路径引用。
 */
export { default as StudentReportExportDialog } from '@/components/student-report/StudentReportExportDialog.vue'
export { default as StudentReportPreviewCard } from '@/components/student-report/StudentReportPreviewCard.vue'
export { default as StudentReportExportSidebar } from '@/components/student-report/StudentReportExportSidebar.vue'
