import { describe, expect, it } from 'vitest'
import { focus, type DesktopWindowState, useDesktopStore } from './store'

const windows: DesktopWindowState[] = ['a', 'b', 'c'].map((id, index) => ({ id, title: id, kind: 'game', minimized: false, maximized: false, zIndex: index + 1 }))

describe('desktop activation', () => {
  it('does no work for repeated current-window or missing-window focus', () => {
    expect(focus(windows, 'c')).toBe(windows)
    expect(focus(windows, 'missing')).toBe(windows)
  })
  it('preserves bounded distinct ranks through repeated switching', () => {
    let current = windows
    for (let index = 0; index < 1000; index++) current = focus(current, index % 2 ? 'b' : 'a')
    expect(current.map(window => window.zIndex).sort()).toEqual([1, 2, 3])
    expect(current.find(window => window.id === 'b')?.zIndex).toBe(3)
  })
  it('restores minimized windows and keeps subsequent launches in front after closing', () => {
    expect(focus(windows.map(window => ({ ...window, minimized: true })), 'a').find(window => window.id === 'a')?.minimized).toBe(false)
    const store = useDesktopStore
    const original = store.getState()
    store.setState({ windows })
    store.getState().closeWindow('b')
    store.getState().openGame('d', 'New game')
    expect(store.getState().windows.map(window => window.zIndex).sort()).toEqual([1, 2, 3])
    store.setState(original)
  })
})
