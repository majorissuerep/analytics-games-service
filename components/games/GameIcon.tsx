import Image from 'next/image'

export function GameIcon({ icon, size = 48 }: { icon?: string; size?: number }) {
  return icon?.startsWith('/icons/')
    ? <Image src={icon} alt="" width={size} height={size} unoptimized />
    : <span aria-hidden>{icon ?? '🎮'}</span>
}
