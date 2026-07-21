import { DesktopShell } from '@/components/desktop/DesktopShell'
import { listPlatformGames } from '@/lib/platform/catalog'

export const dynamic = 'force-dynamic'

export default async function PlatformHome() {
  const games = await listPlatformGames()
  return <DesktopShell games={games} />
}
