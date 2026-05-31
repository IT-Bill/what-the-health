import assert from "node:assert/strict";
import { buildPostPersonaSignals } from "./interaction-memory";

const signals = buildPostPersonaSignals({
  action: "like",
  post: {
    id: "post-1",
    title: "与焦虑共处的艺术",
    excerpt: "焦虑不是敌人，它是身体的信使。",
    category: "mindfulness",
  },
});

assert.deepEqual(signals.focusAreas, ["与焦虑共处的艺术", "mindfulness"]);
assert.match(signals.preferenceSignals?.[0] ?? "", /点赞/);
assert.match(signals.preferenceSignals?.[0] ?? "", /与焦虑共处的艺术/);

console.log("interaction memory persona signals ok");
