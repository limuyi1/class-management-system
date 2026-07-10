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
  singleCommentPolish: string
  batchCommentPolish: string
  imageScore: string
  tagGenerate: string
  tagCategoryGenerate: string
  answerGenerate: string
  learningAnalysis: string
}

export const DefaultAIPrompts: AIPromptsType = {
  singleComment: `请根据以下学生信息生成一段小学期末评语：
学生姓名：{{name}}
学生标签：{{tags}}

说明：
1. 请主要结合学生标签、日常表现、行为习惯和学期整体表现来写期末评语
2. 若标签较少，可结合小学生常见校园表现作合理、保守的概括性补充，但不要编造具体未提供的事件
3. 不要依据成绩、分数或成绩趋势来撰写评语
4. 不要出现“成绩差”“成绩不好”“不理想”“薄弱”“退步明显”等直接负面学业判断

角色：小学班主任
撰写要求：
1. 评语积极正面、温和鼓励，贴合小学生年龄特点
2. 紧密结合学生标签体现出的个性、习惯、态度或成长方向展开评价
3. 语言自然亲切，有班主任口吻，避免空泛套话
4. 每条评语必须在最终输出前自行检查字数，按中文正文字符数估算，空格不计入
5. 若少于100字，必须先补充概括性表现、成长方向或鼓励建议后再输出；若超过120字，必须先删减重复修饰和泛泛表述后再输出
6. 最终输出必须保证100-120字之间，不能少于100字，也不能超过120字
7. 开头不出现学生姓名，直接以评语内容开篇，不使用”该生””本学生”等书面称谓
8. 除非确实不贴切，否则应自然融入一句有文学质感和教育格局的经典表达，优先选用古诗文、传统典籍、名人名言或广为流传的格言警句。所用句子必须贴合学生标签和成长方向，不加引号，不解释出处，不堆砌多句，不为引用而引用
9. 对不足之处要委婉表达，并给出积极期待，不使用批评、否定或标签化语言
10. 输出纯文本，不要标题、编号、Markdown、引号或其他格式标记`,

  batchComment: `请为以下所有学生生成期末评语，仅返回标准JSON数组，不要返回JSON以外的任何文字，确保JSON可直接解析：
{{students}}

单条学生数据结构：
{
  "studentId": "系统提供的学生ID",
  "name": "姓名",
  "tags": "标签1、标签2、标签3",
  "comment": "生成的评语",
  "classicExpression": "本条评语实际使用的经典表达，未使用则为空字符串"
}

其中：
1. tags 为轻量化标签短字符串，请结合其中体现的个性特点、日常表现和学期整体表现生成期末评语
2. 不要依据成绩、分数或成绩趋势来撰写评语
3. 即使某个学生 tags 为空，也必须生成自然、得体、鼓励性的期末评语
4. 不要出现“成绩差”“成绩不好”“不理想”“薄弱”“退步明显”等直接负面学业判断
5. 不要编造具体未提供的事件，可做概括性、保守性的校园表现描述

生成要求：
1. 每个学生都必须生成一条评语，不得遗漏，不得新增学生，不得修改 studentId 或 name
2. 评语积极正面、温和鼓励，贴合小学生年龄特点
3. 紧密结合学生标签体现出的个性、习惯、态度或成长方向展开评价
4. 每条 comment 必须在最终返回前自行检查字数，按中文正文字符数估算，空格不计入
5. 若某条 comment 少于100字，必须先补充该学生的概括性表现、成长方向或鼓励建议后再返回；若超过120字，必须先删减重复修饰和泛泛表述后再返回
6. 每条 comment 最终都必须保证100-120字之间，不能少于100字，也不能超过120字
7. 开头不出现学生姓名，直接以评语内容开篇，不使用”该生””本学生”等书面称谓
8. 除非确实不贴切，否则每条评语都应自然融入一句有文学质感和教育格局的经典表达，优先选用古诗文、传统典籍、名人名言或广为流传的格言警句。所用句子必须贴合学生标签和成长方向，不加引号，不解释出处，不堆砌多句，不为引用而引用；批量生成时，不同学生应尽量使用不同的经典表达，避免重复套用同一句
9. 对不足之处要委婉表达，并给出积极期待，不使用批评、否定或标签化语言
10. comment 必须是字符串，不能为 null，不能为空字符串
11. classicExpression 必须是字符串，填写本条评语实际使用的经典表达；若确实未使用，则填空字符串，不要包含解释、出处或额外修饰
12. 返回结果中的 studentId 和 name 必须与输入完全一致，不得新增、删减、修改或交换学生信息
13. 仅返回标准JSON数组，不要返回JSON以外的任何文字，不要 Markdown，不要代码块`,

  singleCommentPolish: `请基于以下已有期末评语进行润色：
学生姓名：{{name}}
学生标签：{{tags}}
原评语：{{comment}}

角色：小学班主任
润色要求：
1. 只在原评语基础上优化表达、语气和文采，不改变核心事实，不新增没有依据的具体事件
2. 保持积极、温和、鼓励，适合小学生期末评语
3. 原评语若缺少有文学质感和教育格局的经典表达，除非确实不贴切，否则应自然融入一句贴切名句，优先选用古诗文、传统典籍、名人名言或广为流传的格言警句。所用句子必须贴合学生标签和成长方向，不加引号，不解释出处，不堆砌多句，不为引用而引用
4. 润色后必须在最终输出前自行检查字数，按中文正文字符数估算，空格不计入
5. 若少于100字，必须先补充概括性表现、成长方向或鼓励建议后再输出；若超过120字，必须先删减重复修饰和泛泛表述后再输出
6. 最终输出必须保证100-120字之间，不能少于100字，也不能超过120字
7. 开头不出现学生姓名，不使用“该生”“本学生”等书面称谓
8. 只输出润色后的纯文本，不要标题、解释、Markdown 或 JSON`,

  batchCommentPolish: `请批量润色以下已有期末评语，仅返回标准JSON数组，不要返回JSON以外的任何文字：
{{students}}

单条学生数据结构：
{
  "studentId": "系统提供的学生ID",
  "name": "姓名",
  "tags": "学生标签",
  "comment": "已有评语"
}

返回格式：
[
  {
    "studentId": "系统提供的学生ID",
    "name": "姓名",
    "comment": "润色后的评语",
    "classicExpression": "本条评语实际使用的经典表达，未使用则为空字符串"
  }
]

润色要求：
1. 只优化已有 comment 的表达、语气和文采，不改变核心事实，不新增没有依据的具体事件
2. 保持积极、温和、鼓励，适合小学生期末评语
3. 原评语若缺少有文学质感和教育格局的经典表达，除非确实不贴切，否则每条 comment 都应自然融入一句贴切名句，优先选用古诗文、传统典籍、名人名言或广为流传的格言警句。所用句子必须贴合学生标签和成长方向，不加引号，不解释出处，不堆砌多句，不为引用而引用；批量润色时，不同学生应尽量使用不同的经典表达，避免重复套用同一句
4. 每条 comment 必须在最终返回前自行检查字数，按中文正文字符数估算，空格不计入
5. 若某条 comment 少于100字，必须先补充概括性表现、成长方向或鼓励建议后再返回；若超过120字，必须先删减重复修饰和泛泛表述后再返回
6. 每条 comment 最终都必须保证100-120字之间，不能少于100字，也不能超过120字
7. 开头不出现学生姓名，不使用“该生”“本学生”等书面称谓
8. classicExpression 必须是字符串，填写本条评语实际使用的经典表达；若确实未使用，则填空字符串，不要包含解释、出处或额外修饰
9. 每条输入都必须原样返回 studentId 和 name；仅返回标准JSON数组，不要返回JSON以外的任何文字，不要 Markdown，不要代码块`,

  imageScore: `请识别图片中的学生成绩信息。
图片是一张成绩表或考试成绩截图。

请严格返回以下JSON格式，不要返回JSON以外的任何文字：
{"students": [{"name": "学生姓名", "score": 分数}]}

规则：
1. score 必须为数字类型（整数或保留一位小数），不可为字符串
2. 若学生姓名模糊或无法确认，name 设为 null
3. 若整行无法识别，则不要返回该条记录
4. 仅返回JSON对象，不要返回JSON以外的任何文字`,

  tagGenerate: `请生成 {{count}} 个适合小学生的四字词语学生表现标签。

分类：{{category}}
补充要求：{{requirement}}

标签类型比例建议：积极正向约占60%，委婉建议约占40%
标签风格：积极正向类（如品学兼优、乐于助人）；委婉建议类（如专注待强、细致待进）

仅返回标准JSON数组，不要返回JSON以外的任何文字：
["标签1", "标签2", "标签3"]

注意：
1. 必须返回 {{count}} 个标签
2. 仅返回四字词语，不要其他长度词语
3. 不要有解释性文字，直接返回数组`,

  tagCategoryGenerate: `请生成 {{count}} 个适合小学班主任维护学生表现标签的字典分类名称。

补充要求：{{requirement}}

分类名称要求：
1. 适合用于归纳学生表现标签的大类，例如学习习惯、课堂表现、合作交往
2. 每个分类名称控制在2-6个中文字符
3. 分类之间不要语义重复，不要生成具体标签
4. 不要生成“其他”“综合”“默认分类”等泛化名称

仅返回标准JSON数组，不要返回JSON以外的任何文字：
["分类1", "分类2", "分类3"]`,

  answerGenerate: `你是一位专业的小学数学老师。请根据以下题目内容，生成详细的答案和解析。

题目：{{question}}
{{imageHint}}

请严格返回以下JSON格式，不要返回JSON以外的任何文字：
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
6. 数学公式必须使用LaTeX格式表示（如 $x^2$、$\\frac{a}{b}$）
7. 仅返回JSON对象，不要返回JSON以外的任何文字`,
  learningAnalysis: `你是一位资深小学班主任。请基于以下班级成绩数据 {{dashboard}}，生成一份精炼、客观的 Markdown 学情分析报告。

分析指令：
1.点名机制：在分析“预警学生”或“成绩异动”时，若数据中存在对应学生，必须列出具体学生姓名。禁止使用“部分学生”、“个别同学”等模糊表述，直接输出如“张三（下滑显著）”、“李四（持续低分）”；若无对应学生，明确写“暂无明显预警学生”，不得强行点名。
2.三级结构： 必须且仅使用 ### 整体判断、### 关注重点、### 后续建议 三个标题。
3.内容含量： 每个标题下分 2-3 个无序列表点。每一点需包含“数据事实 + 原因推测”，涉及预警或异动时必须包含具体名单。
4.视觉优化： 加粗关键数据（如平均分、及格率）和学生姓名。
5.使用 > 引用块来强调核心预警信息。
6.语言风格： 职业、克制、去口号化。避免“加油努力”等废话，侧重教学动作的改进。
7.约束条件： 字数严格控制在 300-500字。
8.只输出 Markdown 正文，严禁包裹在代码块内，严禁 HTML。
9.禁止提及：过程性评价、评价录入、AI 配置或系统状态。
10.只使用自然中文表达，禁止直接照抄原始字段名、英文变量名或程序键名；若看到数据键名，必须转换成教师可读的中文含义后再表述。`
}
