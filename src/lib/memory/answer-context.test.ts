import assert from "node:assert/strict";
import { formatAnswerReferenceContext } from "./answer-context";

const now = new Date("2026-05-31T12:00:00.000Z");

const context = formatAnswerReferenceContext({
  healthGoal: "healthyHabits",
  activeGoals: ["睡眠提前 30 分钟", "每天 7000 步"],
  healthRecords: [
    {
      metric: "steps",
      value: 8200,
      unit: "count",
      startDate: new Date("2026-05-31T08:00:00.000Z"),
      sourceName: "Apple Health",
    },
    {
      metric: "sleepAnalysis",
      value: 6.5,
      unit: "h",
      startDate: new Date("2026-05-28T22:00:00.000Z"),
      sourceName: "Apple Health",
    },
  ],
  chatMessages: [
    { role: "user", content: "昨晚睡得一般", createdAt: new Date("2026-05-31T09:00:00.000Z") },
    { role: "assistant", content: "我们先看睡眠节奏。", createdAt: new Date("2026-05-31T09:01:00.000Z") },
  ],
  vectorMemories: [
    { content: "用户收藏过低压力晚间拉伸内容", similarity: 0.82 },
  ],
  interactionMemories: [
    {
      source: "post-like",
      note: "用户点赞了帖子《与焦虑共处的艺术》。这反映了用户对该主题的兴趣或偏好。",
      metadata: {
        title: "与焦虑共处的艺术",
        summary: "焦虑不是敌人，它是身体的信使，文章介绍了觉察焦虑和温和呼吸练习。",
      },
      createdAt: now,
    },
  ],
  now,
});

assert.match(context, /## 健康目标/);
assert.match(context, /healthyHabits/);
assert.match(context, /## 1-7天内健康设备监测数据/);
assert.match(context, /24h内数据/);
assert.match(context, /steps: 8200 count/);
assert.match(context, /## 24h内chat聊天上下文/);
assert.match(context, /用户：昨晚睡得一般/);
assert.match(context, /## 相关向量记忆/);
assert.match(context, /低压力晚间拉伸/);
assert.match(context, /## 近期互动偏好\/点赞历史/);
assert.match(context, /用户点赞了帖子《与焦虑共处的艺术》/);
assert.match(context, /摘要：焦虑不是敌人，它是身体的信使/);

console.log("answer context formatter ok");
