export interface BackupData {
  version: number
  setting: { tableHeaders: any[]; tagCategory: any[]; tags: Record<string, string[]> }
  dataSource: { items: any[] }
  configuration: any
  aiConfig: {
    modelType: string
    model: string
    apiKey: string
    baseUrl: string
    prompts: any
    availableModels: string[]
  }
  theme: { currentTheme: string }
}
