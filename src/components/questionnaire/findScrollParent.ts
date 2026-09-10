/** Nearest ancestor that actually scrolls (overflow auto/scroll). */
export function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = start?.parentElement ?? null
  while (node) {
    const { overflowY } = window.getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return null
}

export function scrollParentToBottom(start: HTMLElement | null, behavior: ScrollBehavior = 'smooth') {
  const scrollParent = findScrollParent(start)
  if (!scrollParent) return
  scrollParent.scrollTo({
    top: scrollParent.scrollHeight,
    behavior,
  })
}
