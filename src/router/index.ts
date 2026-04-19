import { createRouter, createWebHashHistory } from 'vue-router'

import HomePage from '@/views/home/HomePage.vue'
import MainPage from '@/views/main/MainPage.vue'
import Math from '@/views/score/ScorePage.vue'
import Comment from '@/views/evaluation/EvaluationPage.vue'
import Setting from '@/views/setting/SettingPage.vue'
import WrongBook from '@/views/wrong-book/WrongBookPage.vue'
import EmptyPage from '@/views/empty/EmptyPage.vue'

import { useDataSourceStore } from '@/stores/data-source'
import type { NavigationGuardWithThis, RouteLocationNormalized } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/empty',
      name: 'Empty',
      component: EmptyPage
    },
    {
      path: '/',
      redirect: '/home'
    },
    {
      path: '/main',
      name: 'Main',
      component: MainPage,
      children: [
        {
          path: '/home',
          name: 'Home',
          component: HomePage
        },
        {
          path: '/math',
          name: 'Math',
          component: Math
        },
        {
          path: '/comment',
          name: 'Comment',
          component: Comment
        },
        {
          path: '/wrong-book',
          name: 'WrongBook',
          component: WrongBook
        },
        {
          path: '/setting',
          name: 'Setting',
          component: Setting
        }
      ]
    }
  ]
})

type DataSourceGuardStoreType = {
  waitForInitReady: () => Promise<boolean>
  enabledData: unknown[]
}

export function createDataGuard(
  getStore: () => DataSourceGuardStoreType = useDataSourceStore
): NavigationGuardWithThis<undefined> {
  return async (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: (to?: string | false | void) => void
  ) => {
    if (to.path === '/empty') {
      next()
      return
    }

    const store = getStore()
    await store.waitForInitReady()
    const hasData = store.enabledData.length > 0

    if (!hasData) {
      next('/empty')
      return
    }

    next()
  }
}

router.beforeEach(createDataGuard())

export default router
