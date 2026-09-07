import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useWrongBookStore } from '../../src/stores/wrong-book'
import type { WrongQuestion } from '../../src/types/WrongBook'

/**
 * useWrongBookStore store 测试
 * 测试目标：错题本 store
 * 覆盖功能：文件夹/题目增删改查、default 删除保护与递归级联、收藏回迁、
 * folderTree 递归排序、initFolders 兜底、题目类型管理
 */
describe('useWrongBookStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** 构造一道最小完整题目 */
  const createQuestion = (overrides: Partial<WrongQuestion> = {}): WrongQuestion => ({
    id: 'q1',
    folderId: 'default',
    questionText: '1 + 1 = ?',
    questionImages: [],
    answer: '2',
    isFavorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  })

  it('initializes with default folder, selection and preset question types', () => {
    const store = useWrongBookStore()

    expect(store.folders).toHaveLength(1)
    expect(store.folders[0].id).toBe('default')
    expect(store.folders[0].name).toBe('未分类')
    expect(store.selectedFolderId).toBe('default')
    expect(store.questions).toEqual([])
    expect(store.questionTypes).toHaveLength(11)
    expect(store.questionTypes[0]).toEqual({ value: '选择题', label: '选择题' })
  })

  it('adds folders with incrementing order within the same parent', () => {
    const store = useWrongBookStore()
    const first = store.addFolder('数学')
    const second = store.addFolder('语文')

    expect(first.order).toBe(1)
    expect(second.order).toBe(2)
    expect(store.folders.find((folder) => folder.id === first.id)?.name).toBe('数学')
  })

  it('keeps separate order counters for different parents', () => {
    const store = useWrongBookStore()
    const parent = store.addFolder('父文件夹')
    const rootChild = store.addFolder('根级子文件夹')
    const nestedChild = store.addFolder('嵌套子文件夹', parent.id)

    expect(rootChild.parentId).toBeUndefined()
    expect(rootChild.order).toBe(2)
    expect(nestedChild.parentId).toBe(parent.id)
    // 父级下第一个子文件夹从 0 开始计数
    expect(nestedChild.order).toBe(0)
  })

  it('merges folder updates', () => {
    const store = useWrongBookStore()
    const folder = store.addFolder('原名称')

    store.updateFolder(folder.id, { name: '新名称' })

    expect(store.folders.find((item) => item.id === folder.id)?.name).toBe('新名称')
    expect(store.folders.find((item) => item.id === folder.id)?.order).toBe(folder.order)
  })

  it('protects the default folder from deletion', () => {
    const store = useWrongBookStore()

    store.deleteFolder('default')

    expect(store.folders.some((folder) => folder.id === 'default')).toBe(true)
  })

  it('recursively deletes child folders and their questions', () => {
    const store = useWrongBookStore()
    const parent = store.addFolder('父文件夹')
    const child = store.addFolder('子文件夹', parent.id)
    const grandchild = store.addFolder('孙文件夹', child.id)
    const parentQuestion = store.addQuestion(createQuestion({ folderId: parent.id }))
    const grandchildQuestion = store.addQuestion(createQuestion({ id: 'q2', folderId: grandchild.id }))
    const unrelatedQuestion = store.addQuestion(createQuestion({ id: 'q3', folderId: 'default' }))
    // 选中被删除的文件夹本身，验证删除后回退到 default
    store.selectedFolderId = parent.id

    store.deleteFolder(parent.id)

    expect(store.folders.some((folder) => folder.id === parent.id)).toBe(false)
    expect(store.folders.some((folder) => folder.id === child.id)).toBe(false)
    expect(store.folders.some((folder) => folder.id === grandchild.id)).toBe(false)
    expect(store.questions.some((question) => question.id === parentQuestion.id)).toBe(false)
    expect(store.questions.some((question) => question.id === grandchildQuestion.id)).toBe(false)
    expect(store.questions.some((question) => question.id === unrelatedQuestion.id)).toBe(true)
    // 删除当前选中文件夹后回退到 default
    expect(store.selectedFolderId).toBe('default')
  })

  it('adds questions with generated id and timestamps', () => {
    const store = useWrongBookStore()

    const question = store.addQuestion({
      folderId: 'default',
      questionText: '2 + 2 = ?',
      questionImages: [],
      answer: '4',
      isFavorite: false
    })

    expect(question.id).toMatch(/^[0-9a-z]+$/)
    expect(question.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(question.updatedAt).toBe(question.createdAt)
    expect(store.questions).toHaveLength(1)
  })

  it('updates questions and refreshes updatedAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:00:00Z'))
    const store = useWrongBookStore()
    const question = store.addQuestion(createQuestion())

    vi.setSystemTime(new Date('2026-09-08T09:30:00Z'))
    store.updateQuestion(question.id, { answer: '3' })

    expect(store.questions[0].answer).toBe('3')
    expect(store.questions[0].questionText).toBe(question.questionText)
    expect(store.questions[0].updatedAt).toBe('2026-09-08T09:30:00.000Z')
    expect(store.questions[0].createdAt).toBe(question.createdAt)
  })

  it('deletes questions by id', () => {
    const store = useWrongBookStore()
    const question = store.addQuestion(createQuestion())

    store.deleteQuestion(question.id)

    expect(store.questions).toHaveLength(0)
  })

  it('moves a favorite question back to its original folder on unfavorite', () => {
    const store = useWrongBookStore()
    store.folders.push({ id: 'favorites', name: '收藏', order: -1, createdAt: '' })
    const mathFolder = store.addFolder('数学')
    const question = store.addQuestion(createQuestion({ folderId: mathFolder.id }))

    store.toggleFavorite(question.id)
    expect(store.questions[0].isFavorite).toBe(true)
    expect(store.questions[0].folderId).toBe('favorites')
    expect(store.questions[0].originalFolderId).toBe(mathFolder.id)
    expect(store.favoriteQuestions).toHaveLength(1)

    store.toggleFavorite(question.id)
    expect(store.questions[0].isFavorite).toBe(false)
    expect(store.questions[0].folderId).toBe(mathFolder.id)
    expect(store.favoriteQuestions).toHaveLength(0)
  })

  it('falls back to default folder when unfavoriting without original folder', () => {
    const store = useWrongBookStore()
    const question = store.addQuestion(createQuestion({ isFavorite: true, folderId: 'favorites' }))

    store.toggleFavorite(question.id)

    expect(store.questions[0].folderId).toBe('default')
    expect(store.questions[0].isFavorite).toBe(false)
  })

  it('moves questions between folders and refreshes updatedAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T08:00:00Z'))
    const store = useWrongBookStore()
    const mathFolder = store.addFolder('数学')
    const question = store.addQuestion(createQuestion())

    vi.setSystemTime(new Date('2026-09-08T09:30:00Z'))
    store.moveQuestion(question.id, mathFolder.id)

    expect(store.questions[0].folderId).toBe(mathFolder.id)
    expect(store.questions[0].updatedAt).toBe('2026-09-08T09:30:00.000Z')
  })

  it('filters questions for the selected folder', () => {
    const store = useWrongBookStore()
    const mathFolder = store.addFolder('数学')
    store.questions = [
      createQuestion({ id: 'q1', folderId: 'default' }),
      createQuestion({ id: 'q2', folderId: mathFolder.id })
    ]

    expect(store.currentFolderQuestions.map((question) => question.id)).toEqual(['q1'])

    store.selectFolder(mathFolder.id)
    expect(store.currentFolderQuestions.map((question) => question.id)).toEqual(['q2'])
    expect(store.selectedFolder?.name).toBe('数学')
  })

  it('builds a nested folder tree sorted by order', () => {
    const store = useWrongBookStore()
    const parent = store.addFolder('父文件夹')
    store.folders.push(
      { id: 'c-2', name: '子二', parentId: parent.id, order: 2, createdAt: '' },
      { id: 'c-0', name: '子零', parentId: parent.id, order: 0, createdAt: '' },
      { id: 'c-1', name: '子一', parentId: parent.id, order: 1, createdAt: '' }
    )
    const root = store.folders.find((folder) => folder.id === 'default')!

    const tree = store.folderTree
    expect(tree).toHaveLength(2)
    expect(tree[0].id).toBe(root.id)
    expect(tree[1].id).toBe(parent.id)
    expect(tree[1].children.map((child) => child.id)).toEqual(['c-0', 'c-1', 'c-2'])
    expect(tree[1].children[0].children).toEqual([])
  })

  it('ensures default and favorites folders exist via initFolders', () => {
    const store = useWrongBookStore()
    // 模拟持久化恢复后文件夹列表被覆盖为空的情况
    store.folders = []

    store.initFolders()

    expect(store.folders.some((folder) => folder.id === 'default')).toBe(true)
    expect(store.folders.some((folder) => folder.id === 'favorites')).toBe(true)
    expect(store.folders.find((folder) => folder.id === 'favorites')?.order).toBe(-1)
  })

  it('does not duplicate folders when initFolders runs twice', () => {
    const store = useWrongBookStore()

    store.initFolders()
    store.initFolders()

    expect(store.folders.filter((folder) => folder.id === 'default')).toHaveLength(1)
    expect(store.folders.filter((folder) => folder.id === 'favorites')).toHaveLength(1)
  })

  it('manages question type options', () => {
    const store = useWrongBookStore()
    const initialCount = store.questionTypes.length

    expect(store.addQuestionType('连线题')).toBe(true)
    expect(store.questionTypes).toHaveLength(initialCount + 1)
    // 重复添加返回 false
    expect(store.addQuestionType('连线题')).toBe(false)
    expect(store.questionTypes).toHaveLength(initialCount + 1)

    store.updateQuestionType('连线题', '配对题')
    expect(store.questionTypes.some((type) => type.value === '配对题')).toBe(true)
    expect(store.questionTypes.some((type) => type.value === '连线题')).toBe(false)

    store.deleteQuestionType('配对题')
    expect(store.questionTypes).toHaveLength(initialCount)
  })
})
