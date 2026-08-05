import { chatWithFallback, buildUserContext, type CoachMessage } from "@/lib/ai-coach"
import prisma from "@/lib/db"

const ROUND_LABEL: Record<string, string> = {
  first: "一面", second: "二面", third: "三面", final: "终面",
  hr: "HR面", written: "笔试", other: "其他",
}

const PREP_SYSTEM_PROMPT = `你是一位资深的技术面试教练,有 10 年以上招聘经验,擅长为候选人做面试前押题和个性化准备。
你了解候选人的真实面试数据(下方【用户数据】),请基于这些生成一份针对性、可操作的面试准备方案。

## 输出要求(用 Markdown 输出)
# 【岗位】面试准备方案
## 一、押题清单(预计会被问到的高频问题)
- 按类别列出 6-10 个高频题:技术基础 / 项目深挖 / 系统设计 / 行为面试 / HR
- 每题标注:考察什么、回答要点

## 二、你的薄弱项强化
- 基于【用户数据】中最薄弱的 1-2 个维度,给出具体的准备方法和 2-3 道针对性练习题

## 三、优先级练习计划
- 按"先补什么、再练什么"给出 3 步练习计划(今天/本周)

## 四、临场建议
- 针对该岗位 1-2 条实用建议

要求:具体、可操作,不要泛泛而谈;基于用户的真实薄弱项,不要套模板。`

function buildPrepPrompt(
  company: string,
  position: string,
  roundType: string,
  userContext: string,
  experiencesText: string,
  sourceNote: string
): string {
  return `请为目标面试生成准备方案。

## 目标面试
- 公司:${company}
- 岗位:${position}
- 轮次:${ROUND_LABEL[roundType] || roundType}

## 【该公司的历史真实面经】（来自用户匿名贡献，可信度高）
${experiencesText}
> 数据来源：${sourceNote}。请在押题清单开头用一行注明"押题依据：${sourceNote}（由面经库统计）"。
> 请优先把面经中出现的高频题放进押题清单，并结合这些真实题目给出针对性回答要点。

## 【用户数据】
${userContext}

请按输出要求生成 Markdown 格式的准备方案。`
}

function mockPrepReply(company: string, position: string): string {
  return `# ${company} · ${position} 面试准备方案(基础模式)

> 当前未配置 AI API Key,以下为通用建议。配置 Key 后可生成基于你真实薄弱项的定制方案。

## 一、押题清单
- **技术基础**:岗位相关的核心原理、常用框架/工具、数据结构与算法基础
- **项目深挖**:"介绍你最有挑战的一个项目"、"为什么这样设计"、"遇到的最大困难"
- **行为面试**:自我介绍、最大的成就、团队冲突如何处理、职业规划
- **HR**:为什么选择我们、薪资期望、可到岗时间

## 二、薄弱项强化
- 用 STAR 法则组织项目案例(情境-任务-行动-结果),准备 2-3 个量化数据
- 针对高频行为题提前写好回答框架

## 三、优先级练习计划
1. 今天:梳理 2 个最拿手的项目,准备量化数据
2. 本周:按岗位高频题,每天练 2-3 题(口述并录音)
3. 面试前:模拟面试 1 次,复盘薄弱项

## 四、临场建议
- 先回答结论,再展开细节
- 不会的题,诚实说明思路,比硬编好`
}

export async function generatePrepPlan(
  userId: string,
  company: string,
  position: string,
  roundType: string
): Promise<string> {
  const userContext = await buildUserContext(userId)

  // 读取该公司历史面经（用户匿名贡献），增强押题准确性
  const [experiences, totalExp] = await Promise.all([
    prisma.interviewExperience.findMany({
      where: { company },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.interviewExperience.count({ where: { company } }),
  ])

  // 来源量统计（C）：去重贡献者数
  const distinctUsers = await prisma.interviewExperience.findMany({
    where: { company, userId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  })
  const contributorCount = distinctUsers.length
  const sourceNote =
    totalExp > 0
      ? `${totalExp} 条真实面经，来自 ${contributorCount} 位候选人${
          totalExp > contributorCount ? "（含早期匿名贡献）" : ""
        }`
      : "暂无历史面经"

  const experiencesText = experiences.length
    ? experiences
        .map((e) => `- [${e.position}${e.round && e.round !== "other" ? `·${ROUND_LABEL[e.round]}` : ""}] ${e.question}`)
        .join("\n")
    : "暂无该公司的历史面经"

  const system = `${PREP_SYSTEM_PROMPT}\n\n## 【用户数据】\n${userContext}`
  const prompt = buildPrepPrompt(company, position, roundType, userContext, experiencesText, sourceNote)
  const messages: CoachMessage[] = [{ role: "user", content: prompt }]

  return chatWithFallback(system, messages, () => mockPrepReply(company, position))
}
