/**
 * 지금 연결돼 있는가.
 *
 * 왜 필요한가: 연결이 끊기면 화면이 **조용히 비거나 "없다"고 말합니다.** 비행기모드로
 * 앱을 열었을 때 "저장된 결과를 찾지 못했습니다" 가 떴습니다. 결과는 그대로 있는데요
 * (docs/MEBODY_TESTER_WALKTHROUGH_2026-10-06.md 1-2).
 * 데이터가 없는 것과 못 가져온 것은 사용자에게 완전히 다른 일입니다.
 *
 * `navigator.onLine` 은 "랜선이 꽂혀 있나" 수준이라 거짓 양성이 있습니다(연결은 됐는데
 * 인터넷이 안 되는 경우). 그래서 **끊김을 알리는 용도로만** 씁니다 —
 * false 면 확실히 끊긴 것이고, true 라고 해서 된다고 단정하지 않습니다.
 */
import { useEffect, useState } from 'react'

function read(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(read)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    // 이벤트를 놓친 채로 들어온 경우(백그라운드에서 바뀜)를 위해 한 번 맞춥니다.
    setOnline(read())
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}
