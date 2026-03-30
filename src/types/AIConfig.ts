export enum AIModelTypeEnum {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  KIMI = 'kimi',
  DOUBAN = 'doubao',
  DEEPSEEK = 'deepseek'
}

export const AIModelTypeLabels: Record<AIModelTypeEnum, string> = {
  [AIModelTypeEnum.OPENAI]: 'OpenAI',
  [AIModelTypeEnum.GEMINI]: 'Google Gemini',
  [AIModelTypeEnum.KIMI]: '月之暗面 Kimi',
  [AIModelTypeEnum.DOUBAN]: '字节跳动 豆包',
  [AIModelTypeEnum.DEEPSEEK]: 'DeepSeek'
}

export const AIModelDefaultBaseUrls: Record<AIModelTypeEnum, string> = {
  [AIModelTypeEnum.OPENAI]: 'https://api.openai.com/v1',
  [AIModelTypeEnum.GEMINI]: 'https://generativelanguage.googleapis.com/v1',
  [AIModelTypeEnum.KIMI]: 'https://api.moonshot.cn/v1',
  [AIModelTypeEnum.DOUBAN]: 'https://ark.cn-beijing.volces.com/api/v3',
  [AIModelTypeEnum.DEEPSEEK]: 'https://api.deepseek.com/v1'
}

export const AIModelDefaultModels: Record<AIModelTypeEnum, string> = {
  [AIModelTypeEnum.OPENAI]: 'gpt-4o-mini',
  [AIModelTypeEnum.GEMINI]: 'gemini-2.0-flash',
  [AIModelTypeEnum.KIMI]: 'moonshot-v1-8k-vision-preview',
  [AIModelTypeEnum.DOUBAN]: 'doubao-vision-pro',
  [AIModelTypeEnum.DEEPSEEK]: 'deepseek-chat'
}

export interface AIConfigType {
  modelType: AIModelTypeEnum
  model: string
  apiKey: string
  baseUrl: string
  prompts: AIPromptsType
}

export interface AIPromptsType {
  singleComment: string
  batchComment: string
  imageScore: string
  tagGenerate: string
  answerGenerate: string
}

export const DefaultAIPrompts: AIPromptsType = {
  singleComment: `请根据以下学生信息生成一段小学期末评语：
学生姓名：{{name}}
学生标签：{{tags}}
考试成绩：{{score}}分

角色：小学班主任
撰写要求：
1. 评语积极正面、温和鼓励，贴合小学生年龄特点
2. 紧密结合学生标签的个性/行为特点展开评价
3. 字数严格控制在100-130字
4. 开头不出现学生姓名，直接以评语内容开篇，不使用“该生”“本学生”等书面称谓
5. 可恰当引经据典，提升文采与教育意义
6. 输出纯文本，无任何格式、符号、标记`,

  batchComment: `请为以下所有学生生成期末评语，仅返回标准JSON数组，无任何多余文字、解释或格式符号，确保JSON可直接解析：
{{students}}

单条学生数据结构：
{
  "name": "姓名",
  "tags": ["标签1","标签2",...],
  "score": "成绩",
  "comment": "生成的评语"
}

生成要求：
1. 若 tags 为空数组 / 无标签，则 comment 直接设为 null，不生成评语。
2. 若 tags 有内容，才生成评语：
    2.1. 评语积极正面、温和鼓励，贴合小学生特点
    2.2. 紧密结合学生标签的个性/行为特点展开评价
    2.3. 字数严格控制在100-130字
    2.4. 开头不出现学生姓名，直接以评语内容开篇，不使用“该生”“本学生”等书面称谓
    2.5. 可恰当引经据典，提升文采与教育意义`,

  imageScore: `请识别图片中的学生成绩信息。
图片是一张成绩表或考试成绩截图。

请返回JSON格式：
{students: [{name: "学生姓名", score: 成绩分数}]}

如果无法识别到成绩，请返回空数组：{students: []}`,

  tagGenerate: `请生成 {{count}} 个适合小学生的四字词语学生表现标签，可包含积极正向及委婉贬义描述（如粗心大意、声音偏小等）；
符合 {{category}} 分类要求，若 {{requirement}} 不为空则同时满足该要求。
仅返回标准 JSON 数组，无任何多余文字、解释或格式符号，确保可直接解析。
返回格式示例：["标签1", "标签2", "标签3"]`,

  answerGenerate: `你是一位专业的小学数学老师。请根据以下题目内容，生成详细的答案和解析。

题目：{{question}}
{{imageHint}}

请返回JSON格式：
{
  "answer": "答案内容",
  "explanation": "详细解析，包含解题步骤和思路"
}

要求：
1. 答案要准确、简洁
2. 解析要详细，包含解题步骤和思路分析
3. 如果是选择题或填空题，直接给出答案
4. 如果是解答题，要给出完整解题过程
5. 使用通俗易懂的语言，符合小学生认知水平
6. 适当使用数学公式（用LaTeX格式表示）
7. 仅返回JSON对象，不要有其他文字`
}
