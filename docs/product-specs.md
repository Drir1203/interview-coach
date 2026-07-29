# 产品功能规格说明书

## 1. 数据模型

### Prisma Schema（PostgreSQL）

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified  DateTime?
  image         String?
  passwordHash  String?
  apiKeyClaude  String?
  apiKeyOpenAI  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
  interviews    Interview[]
  skillProfiles UserSkillProfile[]
  tags          Tag[]
}

model Company {
  id         String @id @default(cuid())
  name       String
  industry   String?
  interviews Interview[]
}

model Interview {
  id               String   @id @default(cuid())
  date             DateTime @default(now())
  status           String   @default("draft") // draft | recorded | ai_reviewed | archived
  userId           String
  companyId        String
  position         String
  roundType        String   // first | second | third | final | hr | written | other
  result           String?  // pass | fail | waiting | unknown
  userNotes        String?
  overallScore     Float?
  overallFeedback  String?
  strengths        String?  // JSON
  improvementAreas String?  // JSON
  weaknessAreas    String?  // JSON
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  company          Company  @relation(fields: [companyId], references: [id])
  questions        InterviewQuestion[]
  recordings       AudioRecording[]
  tags             InterviewTag[]
}

model InterviewQuestion {
  id               String @id @default(cuid())
  interviewId      String
  order            Int
  questionText     String
  userAnswer       String?
  userScore        Int?
  aiScore          Float?
  aiFeedback       String?
  aiImprovedAnswer String?
  aiCategory       String? // technical | behavioral | project_deep_dive | system_design | hr
  aiKeyMistake     String?
  interview        Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
}

model AudioRecording {
  id          String   @id @default(cuid())
  interviewId String
  audioData   String?
  audioUrl    String?
  duration    Int
  transcript  String?
  status      String   @default("recorded") // recorded | transcribing | transcribed | failed
  createdAt   DateTime @default(now())
  interview   Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
}

model Tag {
  id         String @id @default(cuid())
  userId     String
  name       String
  color      String @default("#6366f1")
  user       User   @relation(fields: [userId], references: [id])
  interviews InterviewTag[]
  @@unique([userId, name])
}

model InterviewTag {
  interviewId String
  tagId       String
  interview   Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  tag         Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([interviewId, tagId])
}

model UserSkillProfile {
  id             String   @id @default(cuid())
  userId         String
  category       String
  averageScore   Float    @default(0)
  interviewCount Int      @default(0)
  lastScore      Float?
  lastDate       DateTime?
  user           User     @relation(fields: [userId], references: [id])
  @@unique([userId, category])
}
```

## 2. API 路由设计

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/auth/[...nextauth]` | GET/POST | Auth.js 认证 |
| `/api/auth/register` | POST | 注册 |
| `/api/interviews` | GET/POST | 面试列表 / 创建 |
| `/api/interviews/[id]` | GET/PUT/DELETE | 单条面试 CRUD |
| `/api/review` | POST | AI 复盘 |
| `/api/transcribe` | POST | 录音转写 |
| `/api/analysis` | GET | 数据分析（技能画像+趋势+统计） |
| `/api/mock` | POST | 模拟面试（start/respond/end） |

## 3. AI 复盘 Prompt 设计

```
System: 你是一位资深的技术面试官...
User: 分析面试记录（公司/岗位/轮次/问题列表）
Output JSON: overallScore, overallFeedback, strengths, improvementAreas,
             questions[{score, feedback, improvedAnswer, category, keyMistake}],
             weaknessAreas[{category, score, description}]
```

## 4. 面试状态枚举

| 状态 | 说明 |
|------|------|
| draft | 草稿，录入中 |
| recorded | 已记录，问题已录入 |
| ai_reviewed | AI 复盘完成 |
| archived | 已归档 |

## 5. 面试结果枚举

| 值 | 标签 |
|----|------|
| unknown | 未知 |
| pass | 通过 |
| fail | 未通过 |
| waiting | 等待结果 |

## 6. 能力维度

| category | label | 说明 |
|----------|-------|------|
| technical | 技术基础 | Java/Go/算法/数据结构 |
| behavioral | 行为面试 | STAR 法则/沟通/协作 |
| project_deep_dive | 项目深挖 | 架构/难点/量化数据 |
| system_design | 系统设计 | 高并发/分布式/架构 |
| hr | HR 面试 | 职业规划/薪资/动机 |
