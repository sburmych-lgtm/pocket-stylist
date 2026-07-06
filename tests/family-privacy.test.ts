import assert from "node:assert/strict";
import test from "node:test";
import { wardrobeVisibilityWhere } from "../server/services/family.ts";

test("owners see their full wardrobe", () => {
  assert.deepEqual(wardrobeVisibilityWhere("user-a", "user-a"), {
    userId: "user-a",
  });
});

test("family viewers can query only explicitly shared items", () => {
  assert.deepEqual(wardrobeVisibilityWhere("user-a", "user-b"), {
    userId: "user-b",
    sharedWithFamily: true,
  });
});
