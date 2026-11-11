import { LoadingState } from '@/components/ui/LoadingState'

export default function LoadingGame() {
  return <main className="app-surface ui-loading-screen"><LoadingState scope="app" label="Opening game" detail="Loading the app and its controls." /></main>
}
