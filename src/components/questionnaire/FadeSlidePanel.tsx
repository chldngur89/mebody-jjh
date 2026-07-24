import type { ReactNode } from 'react'

interface FadeSlidePanelProps {
  children: ReactNode
  className?: string
}

export function FadeSlidePanel({ children, className = '' }: FadeSlidePanelProps) {
  return <div className={`animate-fade-slide-in ${className}`.trim()}>{children}</div>
}
