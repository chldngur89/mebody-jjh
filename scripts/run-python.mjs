/**
 * 파이썬 검증 스크립트 런처.
 *
 * verify:v1-excel 은 openpyxl 이 필요합니다. 시스템 python3 에는 보통 없고,
 * 이 저장소는 `.venv` 에 깔아 씁니다. 그런데 package.json 이 `python3` 를 직접 부르고 있어서
 * venv 를 만들어 두고도 "openpyxl required" 로 실패했습니다.
 *
 * 그래서 여기서 고릅니다. `.venv/bin/python3` 가 있으면 그것, 없으면 시스템 python3.
 * 둘 다 안 되면 무엇을 해야 하는지 알려 줍니다.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const script = process.argv[2]
if (!script) {
  console.error('사용: node scripts/run-python.mjs <스크립트.py>')
  process.exit(2)
}

const candidates = ['.venv/bin/python3', '.venv/bin/python']
const python = candidates.find((p) => existsSync(p)) ?? 'python3'

const r = spawnSync(python, [script, ...process.argv.slice(3)], { stdio: 'inherit' })
if (r.error) {
  console.error(`\n${python} 을 실행하지 못했습니다: ${r.error.message}`)
  console.error('python3 -m venv .venv && .venv/bin/pip install openpyxl')
  process.exit(1)
}
process.exit(r.status ?? 1)
