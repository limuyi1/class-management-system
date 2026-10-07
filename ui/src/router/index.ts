/**
 * Vue Router 路由配置
 * 使用 hash 模式，支持 /overview, /score, /evaluation, /setting 等主要路由
 */
import { h } from 'vue'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'

import MainPage from '@/views/main/MainPage.vue'
import RootRedirectPage from '@/views/root/RootRedirectPage.vue'

import { useDataSourceStore } from '@/stores/data-source'
import type { NavigationGuardWithThis, RouteLocationNormalized } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'RootRedirect',
      component: RootRedirectPage
    },
    {
      path: '/main',
      name: 'Main',
      component:
        import.meta.env.VITE_STORAGE_MODE === 'legacy' ? MainPage : { render: () => h(RouterView) },
      // 子路由页面采用懒加载，按需请求对应组件以减小首屏体积
      children: [
        {
          path: '/overview',
          name: 'Overview',
          component: () => import('@/views/overview/OverviewPage.vue')
        },
        {
          path: '/score',
          name: 'Score',
          component: () => import('@/views/score/ScorePage.vue')
        },
        {
          path: '/student-info',
          name: 'StudentInfo',
          component: () => import('@/views/student-info/StudentInfoPage.vue')
        },
        {
          path: '/tools',
          name: 'Tools',
          component: () => import('@/views/tools/ToolsPage.vue')
        },
        {
          path: '/tools/comments',
          name: 'CommentTool',
          component: () => import('@/views/evaluation/EvaluationPage.vue')
        },
        {
          path: '/tools/name-list-compare',
          name: 'NameListCompare',
          component: () => import('@/views/tools/NameListComparePage.vue')
        },
        {
          path: '/tools/attachments',
          name: 'AttachmentLibrary',
          component: () => import('@/views/tools/AttachmentLibraryPage.vue')
        },
        {
          path: '/tools/paper-layout',
          name: 'PaperLayout',
          component: () => import('@/views/tools/PaperLayoutPage.vue')
        },
        {
          path: '/tools/score-notice',
          redirect: '/tools/notice-awards/notice'
        },
        {
          path: '/tools/seating-chart',
          name: 'SeatingChart',
          component: () => import('@/views/seating-chart/SeatingChartPage.vue')
        },
        {
          path: '/tools/roster-print',
          name: 'RosterPrint',
          component: () => import('@/views/tools/RosterPrintPage.vue')
        },
        {
          path: '/tools/batch-reports',
          name: 'BatchReports',
          component: () => import('@/views/tools/BatchReportPage.vue')
        },
        {
          path: '/tools/cards',
          redirect: '/tools/notice-awards/certificate'
        },
        {
          path: '/tools/notice-awards',
          component: () => import('@/views/tools/NoticeAwardPage.vue'),
          redirect: '/tools/notice-awards/notice',
          children: [
            {
              path: 'notice',
              name: 'ScoreNotice',
              component: () => import('@/views/score-notice/ScoreNoticePage.vue'),
              props: { embedded: true }
            },
            {
              path: 'certificate',
              name: 'CardTemplates',
              component: () => import('@/views/tools/CardTemplatePage.vue'),
              props: { embedded: true, initialPreset: 'certificate' }
            },
            {
              path: 'card',
              name: 'PraiseCards',
              component: () => import('@/views/tools/CardTemplatePage.vue'),
              props: { embedded: true, initialPreset: 'card' }
            },
            {
              path: 'custom',
              name: 'CustomPrintTemplates',
              component: () => import('@/views/tools/CardTemplatePage.vue'),
              props: { embedded: true, initialPreset: 'blank' }
            }
          ]
        },
        {
          path: '/tools/exam-print',
          name: 'ExamPrint',
          component: () => import('@/views/tools/ExamPrintPage.vue')
        },
        {
          path: '/tools/duty-roster',
          name: 'DutyRoster',
          component: () => import('@/views/duty-roster/DutyRosterPage.vue')
        },
        {
          path: '/setting',
          name: 'Setting',
          component: () => import('@/views/setting/SettingPage.vue')
        }
      ]
    }
  ]
})

/**
 * 创建数据就绪路由守卫
 * 等待学生数据加载完成后校验数据状态，数据为空时限制进入成绩等页面
 * @param getStore - 获取数据源 store 的函数（默认使用 useDataSourceStore）
 * @returns Vue Router 导航守卫
 */
export function createDataGuard(
  getStore: () => Pick<
    ReturnType<typeof useDataSourceStore>,
    'waitForInitReady' | 'enabledData'
  > = useDataSourceStore
): NavigationGuardWithThis<undefined> {
  return async (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: (to?: string | false | void) => void
  ) => {
    // 无学生数据时仍允许访问的页面路径（工具与设置类页面）
    const allowedPaths = [
      '/tools',
      '/tools/comments',
      '/tools/name-list-compare',
      '/tools/attachments',
      '/tools/paper-layout',
      '/tools/score-notice',
      '/tools/seating-chart',
      '/tools/duty-roster',
      '/tools/roster-print',
      '/tools/batch-reports',
      '/tools/cards',
      '/tools/exam-print',
      '/student-info',
      '/setting'
    ]

    if (allowedPaths.includes(to.path) || to.path.startsWith('/tools/notice-awards')) {
      next()
      return
    }

    const store = getStore()
    await store.waitForInitReady()

    if (store.enabledData.length === 0) {
      next('/tools')
      return
    }

    next()
  }
}

// 注册全局前置守卫：等待数据初始化完成，数据为空时重定向到工具页
if (import.meta.env.VITE_STORAGE_MODE === 'legacy') router.beforeEach(createDataGuard())
else {
  const teaching = router.options.routes.find((route) => route.name === 'Main')?.children || []
  router.removeRoute('Main')
  for (const route of teaching) router.addRoute(route)
  for (const path of ['/accounts', '/admin-ai', '/profile', '/devices'])
    router.addRoute({ path, component: { render: () => null } })
  router.addRoute({ path: '/:pathMatch(.*)*', component: { render: () => null } })
}

export default router
