export function createLatestRequestTracker() {
  let generation = 0;
  let controller = null;

  return {
    start() {
      controller?.abort();
      const id = ++generation;
      controller = new AbortController();
      return {
        id,
        signal: controller.signal,
        isCurrent: () => id === generation,
      };
    },
  };
}

export function applyIfCurrent(request, result, apply) {
  if (!request?.isCurrent?.() || result?.aborted) return false;
  apply(result);
  return true;
}
