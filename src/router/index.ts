import { createRouter, createWebHashHistory } from 'vue-router'

import HomePage from '@/views/home/HomePage.vue'
import MainPage from '@/views/main/MainPage.vue'
import Math from '@/views/score/ScorePage.vue'
import Comment from '@/views/evaluation/EvaluationPage.vue'
import Setting from '@/views/setting/SettingPage.vue'
import WrongBook from '@/views/wrong-book/WrongBookPage.vue'
import EmptyPage from '@/views/empty/EmptyPage.vue'

import { useDataSourceStore } from '@/stores/data-source'

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

function waitForDataStore(): Promise<boolean> {
  return new Promise((resolve) => {
    const store = useDataSourceStore()
    if (store.data?.length > 0) {
      resolve(true)
      return
    }
    const unsubscribe = store.$subscribe(
      () => {
        if (store.data?.length > 0) {
          unsubscribe()
          resolve(true)
        }
      },
      { deep: true }
    )
    setTimeout(() => {
      unsubscribe()
      resolve(store.data?.length > 0)
    }, 5000)
  })
}

router.beforeEach(async (to, _from, next) => {
  if (to.path === '/empty') {
    next()
    return
  }

  const hasData = await waitForDataStore()

  if (!hasData) {
    next('/empty')
    return
  }

  next()
})

export default router
