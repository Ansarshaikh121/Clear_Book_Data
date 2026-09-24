/** Keep full-profile writes in user action order so a slow earlier request cannot overwrite newer settings. */
export function createWriteQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue(write: () => Promise<unknown>): Promise<void> {
    const next = tail.catch(() => undefined).then(write);
    tail = next;
    return next.then(() => undefined);
  };
}
