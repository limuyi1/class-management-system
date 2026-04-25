export enum AIModelTypeEnum {
  OPENAI = 'openai',
  GEMINI = 'gemini',
  KIMI = 'kimi',
  DOUBAO = 'doubao',
  DEEPSEEK = 'deepseek'
}

export const AIModelTypeLabels: Record<AIModelTypeEnum, string> = {
  [AIModelTypeEnum.OPENAI]: 'OpenAI',
  [AIModelTypeEnum.GEMINI]: 'Google Gemini',
  [AIModelTypeEnum.KIMI]: '月之暗面 Kimi',
  [AIModelTypeEnum.DOUBAO]: '字节跳动 豆包',
  [AIModelTypeEnum.DEEPSEEK]: 'DeepSeek'
}

export const AIModelDefaultBaseUrls: Record<AIModelTypeEnum, string> = {
  [AIModelTypeEnum.OPENAI]: 'https://api.openai.com/v1',
  [AIModelTypeEnum.GEMINI]: 'https://generativelanguage.googleapis.com/v1',
  [AIModelTypeEnum.KIMI]: 'https://api.moonshot.cn/v1',
  [AIModelTypeEnum.DOUBAO]: 'https://ark.cn-beijing.volces.com/api/v3',
  [AIModelTypeEnum.DEEPSEEK]: 'https://api.deepseek.com/v1'
}

export const AIModelDefaultModels: Record<AIModelTypeEnum, string> = {
  [AIModelTypeEnum.OPENAI]: 'gpt-4o-mini',
  [AIModelTypeEnum.GEMINI]: 'gemini-2.0-flash',
  [AIModelTypeEnum.KIMI]: 'moonshot-v1-8k-vision-preview',
  [AIModelTypeEnum.DOUBAO]: 'doubao-vision-pro',
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
  learningAnalysis: string
}

export const DefaultAIPrompts: AIPromptsType = {
  singleComment: `请根据以下学生信息生成一段小学期末评语：
学生姓名：{{name}}
学生标签：{{tags}}
成绩记录：{{score}}

说明：
1. {{score}} 是成绩数组，数组中每一项结构为 { "label": "考试/单元名称", "value": 分数 }
2. 请结合成绩变化趋势、最近表现和整体水平来写评语，不要只看某一次分数
3. 若成绩数组为空，则主要依据学生标签生成评语

角色：小学班主任
撰写要求：
1. 评语积极正面、温和鼓励，贴合小学生年龄特点
2. 紧密结合学生标签的个性/行为特点展开评价
3. 若无标签，可根据姓名寓意或考试成绩合理联想
4. 字数严格控制在100-120字
5. 开头不出现学生姓名，直接以评语内容开篇，不使用”该生””本学生”等书面称谓
6. 可恰当引经据典，提升文采与教育意义
7. 输出纯文本，无任何格式、符号、标记`,

  batchComment: `请为以下所有学生生成期末评语，仅返回标准JSON数组，无任何多余文字、解释或格式符号，确保JSON可直接解析：
{{students}}

单条学生数据结构：
{
  “name”: “姓名”,
  “tags”: [“标签1”,”标签2”,...],
  “score”: [
    { “label”: “考试/单元名称”, “value”: 分数 }
  ],
  “comment”: “生成的评语”
}

其中：
1. score 是成绩数组，不是单个分数
2. 请结合成绩趋势、最近表现、波动情况和整体水平生成评语
3. 若某个学生 score 为空，也必须结合 tags 正常生成评语

生成要求：
1. 评语积极正面、温和鼓励，贴合小学生年龄特点
2. 紧密结合学生标签的个性/行为特点展开评价
3. 若无标签，可根据姓名寓意或考试成绩合理联想
4. 字数严格控制在100-120字
5. 开头不出现学生姓名，直接以评语内容开篇，不使用”该生””本学生”等书面称谓
6. 可恰当引经据典，提升文采与教育意义
7. 每个学生都必须生成评语，即使标签为空也要生成符合其特点的鼓励性评语
8. 仅返回JSON数组，不要有其他任何文字`,

  imageScore: `请识别图片中的学生成绩信息。
图片是一张成绩表或考试成绩截图。

请严格返回以下JSON格式，勿包含任何其他文字：
{“students”: [{“name”: “学生姓名”, “score”: 分数}]}

规则：
1. score 必须为数字类型（整数或保留一位小数），不可为字符串
2. 若学生姓名模糊或无法确认，name 设为 null
3. 若整行无法识别，该条目 skip 勿留空
4. 仅返回JSON对象，不要有解释性文字`,

  tagGenerate: `请生成 {{count}} 个适合小学生的四字词语学生表现标签。

分类：{{category}}
补充要求：{{requirement}}

标签类型比例建议：积极正向约占60%，委婉建议约占40%
标签风格：积极正向类（如品学兼优、乐于助人）；委婉建议类（如粗心大意、注意力需提升）

仅返回标准JSON数组，无任何多余文字：
[“标签1”, “标签2”, “标签3”]

注意：
1. 生成数量与 {{count}} 的误差不超过2个
2. 仅返回四字词语，不要其他长度词语
3. 不要有解释性文字，直接返回数组`,

  answerGenerate: `你是一位专业的小学数学老师。请根据以下题目内容，生成详细的答案和解析。

题目：{{question}}
{{imageHint}}

请严格返回以下JSON格式，勿包含任何其他文字：
{
  “answer”: “答案内容”,
  “explanation”: “详细解析，包含解题步骤和思路”
}

要求：
1. 答案要准确、简洁
2. 解析要详细，包含解题步骤和思路分析
3. 如果是选择题或填空题，直接给出答案
4. 如果是解答题，要给出完整解题过程
5. 使用通俗易懂的语言，符合小学生认知水平
6. 数学公式必须使用LaTeX格式表示（如 $x^2$、$\\frac{a}{b}$）
7. 仅返回JSON对象，不要有其他任何文字`,
  learningAnalysis: `你是一位资深小学班主任。请基于以下班级成绩数据 {{dashboard}}，生成一份精炼、客观的 Markdown 学情分析报告。

分析指令：
1.点名机制（硬性要求）： 在分析“预警学生”或“成绩异动”时，必须列出具体学生姓名。禁止使用“部分学生”、“个别同学”等模糊表述，直接输出如“张三（下滑显著）”、“李四（持续低分）”。
2.三级结构： 必须且仅使用 ### 整体判断、### 关注重点、### 后续建议 三个标题。
3.内容含量： 每个标题下分 2-3 个无序列表点。每一点需包含“数据事实 + 原因推测/具体名单”。
4.视觉优化： 加粗关键数据（如平均分、及格率）和学生姓名。
5.使用 > 引用块来强调核心预警信息。
6.语言风格： 职业、克制、去口号化。避免“加油努力”等废话，侧重教学动作的改进。
7.约束条件： 字数严格控制在 180-300字。
8.只输出 Markdown 正文，严禁包裹在代码块内，严禁 HTML。
9.禁止提及：过程性评价、评价录入、AI 配置或系统状态。`
}
