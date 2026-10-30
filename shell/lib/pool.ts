export interface Pool {
  executeWithLimit<T>(fn: (slot: number) => Promise<T>): Promise<T>;
}

export function makePool(limit: number): Pool {
  const size = Math.max(1, limit);
  let active = 0;
  let slotSeq = 0;
  const queue: Array<() => void> = [];

  const next = (): void => {
    if (queue.length > 0 && active < size) {
      active++;
      const resolveSlot = queue.shift();
      if (!resolveSlot) throw new Error("internal pool invariant: no resolver");
      resolveSlot();
    }
  };

  return {
    async executeWithLimit<T>(fn: (slot: number) => Promise<T>): Promise<T> {
      const slot = slotSeq++;
      if (active >= size) {
        await new Promise<void>((resolveSlot) => queue.push(resolveSlot));
      } else {
        active++;
      }
      try {
        return await fn(slot);
      } finally {
        active--;
        next();
      }
    }
  };
}
