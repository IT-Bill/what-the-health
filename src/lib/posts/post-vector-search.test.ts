import assert from "node:assert/strict";
import { clampPostVectorLimit } from "./post-vector-search";

assert.equal(clampPostVectorLimit(undefined), 3);
assert.equal(clampPostVectorLimit(1), 1);
assert.equal(clampPostVectorLimit(99), 3);

console.log("post vector search limit ok");
