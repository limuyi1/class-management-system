import { defineStore } from 'pinia'
import type { WrongFolder, WrongQuestion } from '@/types/WrongBook'

/**
 * 生成唯一ID
 * @returns 36进制唯一字符串
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * 错题本状态管理
 * 负责管理文件夹、题目、收藏等功能
 */
export const useWrongBookStore = defineStore('wrongBook', {
  state: () => ({
    /**
     * 文件夹列表
     * 包含默认文件夹和收藏文件夹（固定ID：default/favorites）
     * 注意：persist 可能会覆盖初始值，需要通过 initFolders 确保收藏文件夹存在
     */
    folders: [
      {
        id: 'default',
        name: '未分类',
        order: 0,
        createdAt: new Date().toISOString()
      }
    ] as WrongFolder[],
    /**
     * 题目列表
     * 每道题关联一个 folderId
     */
    questions: [] as WrongQuestion[],
    /**
     * 当前选中的文件夹ID
     */
    selectedFolderId: 'default' as string,
    /**
     * 题目类型选项
     */
    questionTypes: [
      { value: '选择题', label: '选择题' },
      { value: '填空题', label: '填空题' },
      { value: '判断题', label: '判断题' },
      { value: '计算题', label: '计算题' },
      { value: '口算题', label: '口算题' },
      { value: '应用题', label: '应用题' },
      { value: '解答题', label: '解答题' },
      { value: '找规律题', label: '找规律题' },
      { value: '作图题', label: '作图题' },
      { value: '操作题', label: '操作题' },
      { value: '其他', label: '其他' }
    ] as Array<{ value: string; label: string }>
  }),
  getters: {
    /**
     * 获取当前文件夹下的所有题目
     * @returns 当前选中文件夹的题目数组
     */
    currentFolderQuestions: (state) => {
      return state.questions.filter((q) => q.folderId === state.selectedFolderId)
    },
    /**
     * 获取所有收藏的题目
     * @returns isFavorite 为 true 的题目数组
     */
    favoriteQuestions: (state) => {
      return state.questions.filter((q) => q.isFavorite)
    },
    /**
     * 获取当前选中的文件夹对象
     * @returns 文件夹对象或 undefined
     */
    selectedFolder: (state) => {
      return state.folders.find((f) => f.id === state.selectedFolderId)
    },
    /**
     * 构建文件夹树形结构
     * @returns 树形结构的文件夹数组
     */
    folderTree: (state) => {
      const buildTree = (parentId?: string): WrongFolder[] => {
        return state.folders
          .filter((f) => f.parentId === parentId)
          .sort((a, b) => a.order - b.order)
          .map((f) => ({
            ...f,
            children: buildTree(f.id)
          })) as any
      }
      return buildTree(undefined)
    }
  },
  actions: {
    /**
     * 选中文件夹
     * @param id - 文件夹ID
     */
    selectFolder(id: string) {
      this.selectedFolderId = id
    },
    /**
     * 初始化文件夹，确保默认文件夹和收藏文件夹存在
     * 用于处理 persist 加载后缺少收藏文件夹的问题
     */
    initFolders() {
      const hasDefault = this.folders.some((f) => f.id === 'default')
      if (!hasDefault) {
        this.folders.push({
          id: 'default',
          name: '未分类',
          order: 0,
          createdAt: new Date().toISOString()
        })
      }

      const hasFavorites = this.folders.some((f) => f.id === 'favorites')
      if (!hasFavorites) {
        this.folders.push({
          id: 'favorites',
          name: '收藏',
          order: -1,
          createdAt: new Date().toISOString()
        })
      }
    },
    /**
     * 添加新文件夹
     * @param name - 文件夹名称
     * @param parentId - 父文件夹ID（可选，用于嵌套）
     * @returns 新创建的文件夹对象
     */
    addFolder(name: string, parentId?: string) {
      const maxOrder = this.folders
        .filter((f) => f.parentId === parentId)
        .reduce((max, f) => Math.max(max, f.order), -1)

      const newFolder: WrongFolder = {
        id: generateId(),
        name,
        parentId,
        order: maxOrder + 1,
        createdAt: new Date().toISOString()
      }
      this.folders.push(newFolder)
      return newFolder
    },
    /**
     * 更新文件夹信息
     * @param id - 文件夹ID
     * @param updates - 要更新的字段
     */
    updateFolder(id: string, updates: Partial<WrongFolder>) {
      const index = this.folders.findIndex((f) => f.id === id)
      if (index !== -1) {
        this.folders[index] = { ...this.folders[index], ...updates }
      }
    },
    /**
     * 删除文件夹（递归删除子文件夹和题目）
     * @param id - 文件夹ID
     */
    deleteFolder(id: string) {
      if (id === 'default') return
      const deleteRecursively = (folderId: string) => {
        const children = this.folders.filter((f) => f.parentId === folderId)
        children.forEach((c) => deleteRecursively(c.id))
        const folderQuestions = this.questions.filter((q) => q.folderId === folderId)
        folderQuestions.forEach((q) => this.deleteQuestion(q.id))
        const index = this.folders.findIndex((f) => f.id === folderId)
        if (index !== -1) {
          this.folders.splice(index, 1)
        }
      }
      deleteRecursively(id)

      if (this.selectedFolderId === id) {
        this.selectedFolderId = 'default'
      }
    },
    /**
     * 添加新题目
     * @param question - 题目对象（不含 id、createdAt、updatedAt）
     * @returns 新创建的题目对象
     */
    addQuestion(question: Omit<WrongQuestion, 'id' | 'createdAt' | 'updatedAt'>) {
      const now = new Date().toISOString()
      const newQuestion: WrongQuestion = {
        ...question,
        id: generateId(),
        createdAt: now,
        updatedAt: now
      }
      this.questions.push(newQuestion)
      return newQuestion
    },
    /**
     * 更新题目信息
     * @param id - 题目ID
     * @param updates - 要更新的字段
     */
    updateQuestion(id: string, updates: Partial<WrongQuestion>) {
      const index = this.questions.findIndex((q) => q.id === id)
      if (index !== -1) {
        this.questions[index] = {
          ...this.questions[index],
          ...updates,
          updatedAt: new Date().toISOString()
        }
      }
    },
    /**
     * 删除题目
     * @param id - 题目ID
     */
    deleteQuestion(id: string) {
      const index = this.questions.findIndex((q) => q.id === id)
      if (index !== -1) {
        this.questions.splice(index, 1)
      }
    },
    /**
     * 切换题目收藏状态
     * 收藏时自动移入收藏文件夹，取消收藏时移回原文件夹
     * @param id - 题目ID
     */
    toggleFavorite(id: string) {
      const question = this.questions.find((q) => q.id === id)
      if (question) {
        if (!question.isFavorite) {
          question.originalFolderId = question.folderId
          question.folderId = 'favorites'
        } else {
          question.folderId = question.originalFolderId || 'default'
        }
        question.isFavorite = !question.isFavorite
        question.updatedAt = new Date().toISOString()
      }
    },
    /**
     * 移动题目到指定文件夹
     * @param questionId - 题目ID
     * @param targetFolderId - 目标文件夹ID
     */
    moveQuestion(questionId: string, targetFolderId: string) {
      const question = this.questions.find((q) => q.id === questionId)
      if (question) {
        question.folderId = targetFolderId
        question.updatedAt = new Date().toISOString()
      }
    },
    /**
     * 添加题目类型
     * @param label - 类型名称
     * @returns 是否添加成功（已存在则返回 false）
     */
    addQuestionType(label: string) {
      const value = label
      if (this.questionTypes.some((t) => t.value === value)) {
        return false
      }
      this.questionTypes.push({ value, label })
      return true
    },
    /**
     * 更新题目类型
     * @param oldValue - 旧类型值
     * @param newLabel - 新类型名称
     */
    updateQuestionType(oldValue: string, newLabel: string) {
      const type = this.questionTypes.find((t) => t.value === oldValue)
      if (type) {
        type.label = newLabel
        type.value = newLabel
      }
    },
    /**
     * 删除题目类型
     * @param value - 要删除的类型值
     */
    deleteQuestionType(value: string) {
      const index = this.questionTypes.findIndex((t) => t.value === value)
      if (index !== -1) {
        this.questionTypes.splice(index, 1)
      }
    }
  },
  persist: true
})
