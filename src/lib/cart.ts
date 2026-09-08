/**
 * 장바구니 — 이 기기에만 저장합니다.
 *
 * 테이블을 만들지 않았습니다. 담아둔 목록은 결제 전까지 아무 의미가 없고,
 * **가격은 담을 때가 아니라 주문할 때 서버(create_order)가 다시 읽습니다.**
 * 그래서 여기에는 상품 id 와 수량만 둡니다 — 가격을 들고 다니면
 * 오래된 가격으로 주문하려는 시도가 가능해집니다.
 */
const STORAGE_KEY = 'mebody.cart.v1'
const CHANGE_EVENT = 'mebody:cart'
const MAX_QTY = 20

export interface CartLine {
  productId: string
  quantity: number
}

function read(): CartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => ({
        productId: String((row as CartLine)?.productId ?? ''),
        quantity: Math.max(1, Math.min(MAX_QTY, Math.floor(Number((row as CartLine)?.quantity ?? 1)))),
      }))
      .filter((row) => row.productId.length > 0)
  } catch {
    return []
  }
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  } catch {
    /* 저장이 막힌 환경에서는 이번 방문에만 유지됩니다 */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

export function readCart(): CartLine[] {
  return read()
}

export function cartCount(): number {
  return read().reduce((sum, line) => sum + line.quantity, 0)
}

export function addToCart(productId: string, quantity = 1): CartLine[] {
  const lines = read()
  const found = lines.find((line) => line.productId === productId)
  if (found) {
    found.quantity = Math.min(MAX_QTY, found.quantity + quantity)
  } else {
    lines.push({ productId, quantity: Math.max(1, Math.min(MAX_QTY, quantity)) })
  }
  write(lines)
  return lines
}

export function setQuantity(productId: string, quantity: number): CartLine[] {
  const next = read()
    .map((line) => (line.productId === productId ? { ...line, quantity: Math.max(0, Math.min(MAX_QTY, quantity)) } : line))
    .filter((line) => line.quantity > 0)
  write(next)
  return next
}

export function removeFromCart(productId: string): CartLine[] {
  const next = read().filter((line) => line.productId !== productId)
  write(next)
  return next
}

export function clearCart(): void {
  write([])
}

/** 장바구니 변화 구독. 담기 버튼과 탭 배지가 같은 값을 보게 합니다. */
export function onCartChange(handler: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}
