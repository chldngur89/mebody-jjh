/**
 * 044 마이그레이션 적용 전/후를 같은 코드로 견디기 위한 판별기.
 *
 * 044 는 진단 응답의 읽기·쓰기를 SECURITY DEFINER 함수로 옮깁니다.
 * 마이그레이션이 아직 안 된 DB 에서는 그 함수가 없으므로,
 * 호출부가 예전 테이블 경로로 되돌아갈 수 있어야 합니다.
 * 그래야 앱 배포와 SQL 적용 순서를 신경 쓰지 않아도 됩니다.
 */
export function isMissingRpc(error: unknown): boolean {
  if (!error) return false
  const code = String((error as { code?: string }).code ?? '')
  // PGRST202: PostgREST 스키마 캐시에 함수가 없음 / 42883: undefined_function
  if (code === 'PGRST202' || code === '42883') return true

  const text = String((error as { message?: string }).message ?? '').toLowerCase()
  return (
    text.includes('could not find the function') ||
    (text.includes('function') && text.includes('does not exist'))
  )
}

/**
 * 없는 함수를 매번 다시 부르지 않게 기억합니다.
 *
 * 임시저장은 문항을 넘길 때마다 일어납니다. 044 를 적용하기 전이면
 * 그때마다 404 를 한 번씩 더 치게 되는데, 세션 안에서는 결과가 바뀌지 않습니다.
 * 새로고침하면 초기화되므로 마이그레이션을 적용한 뒤 앱을 다시 열면 정상 경로로 돌아갑니다.
 */
const missingRpcs = new Set<string>()

export function isRpcKnownMissing(name: string): boolean {
  return missingRpcs.has(name)
}

export function markRpcMissing(name: string): void {
  missingRpcs.add(name)
}
