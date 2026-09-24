import assert from "node:assert/strict";
import test from "node:test";
import { createWriteQueue } from "./write-queue.ts";

test("later profile saves wait for a slow earlier write", async () => {
  const enqueue = createWriteQueue();
  const events: string[] = [];
  let releaseFirst!: () => void;
  const blocked = new Promise<void>((resolve) => { releaseFirst = resolve; });

  const first = enqueue(async () => {
    events.push("first started");
    await blocked;
    events.push("first saved");
  });
  const second = enqueue(async () => { events.push("second saved"); });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ["first started"]);

  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first started", "first saved", "second saved"]);
});

test("a failed profile save does not block the next one", async () => {
  const enqueue = createWriteQueue();
  await assert.rejects(enqueue(async () => { throw new Error("network"); }), /network/);
  let saved = false;
  await enqueue(async () => { saved = true; });
  assert.equal(saved, true);
});
