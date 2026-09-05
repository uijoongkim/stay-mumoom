export function createLatestRequestGuard() {
  let generation = 0;
  let activeController = null;

  function invalidate() {
    generation += 1;
    activeController?.abort();
    activeController = null;
  }

  function begin() {
    invalidate();
    const requestGeneration = generation;
    const controller = new AbortController();
    activeController = controller;

    return {
      signal: controller.signal,
      isCurrent: () => generation === requestGeneration && activeController === controller,
      complete: () => {
        if (generation === requestGeneration && activeController === controller) {
          activeController = null;
        }
      },
    };
  }

  return { begin, invalidate };
}
