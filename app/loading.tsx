import { LoadingState } from '@/components/ui/LoadingState'

export default function Loading() {
  return <main className="app-surface ui-loading-screen"><LoadingState scope="page" label="Opening Analytics Games" detail="Loading the page and its content." /></main>
}
