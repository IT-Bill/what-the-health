import assert from "node:assert/strict";
import {
  normalizeVectorLimit,
  toPgVectorLiteral,
  vectorMetadataWhereClause,
} from "./pgvector";

assert.equal(toPgVectorLiteral([0, 1.25, -2], 3), "[0,1.25,-2]");
assert.throws(() => toPgVectorLiteral([Number.NaN], 1), /finite number/);
assert.throws(() => toPgVectorLiteral([1, 2], 3), /Expected embedding dimension 3/);

assert.equal(normalizeVectorLimit(undefined), 5);
assert.equal(normalizeVectorLimit(0), 1);
assert.equal(normalizeVectorLimit(99), 20);

assert.deepEqual(vectorMetadataWhereClause({ category: "sleep" }, 3), {
  sql: " AND metadata->>$3 = $4",
  values: ["category", "sleep"],
});

console.log("pgvector helpers ok");
