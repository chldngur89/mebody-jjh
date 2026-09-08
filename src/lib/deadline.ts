/** Stop waiting and abort outstanding fetches; late auth resolution cannot start writes. */
export async function withDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, controller: AbortController, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  let onAbort: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason ?? new Error('Request cancelled'));
    if (controller.signal.aborted) onAbort();
    else controller.signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => controller.abort(new Error('저장 시간이 초과되었습니다.')), ms);
  });
  try { return await Promise.race([Promise.resolve().then(() => { controller.signal.throwIfAborted(); return operation(controller.signal); }), aborted]); }
  finally { clearTimeout(timer!); controller.signal.removeEventListener('abort', onAbort!); }
}
