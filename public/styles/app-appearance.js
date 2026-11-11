/* Shared by Next.js, same-origin game frames, and static cabinets. */
(() => {
  const key = 'analytics-games.material.v1'
  const apply = () => {
    try {
      if (localStorage.getItem(key) === 'solid') document.documentElement.dataset.uiMaterial = 'solid'
      else delete document.documentElement.dataset.uiMaterial
    } catch { /* Storage can be unavailable; CSS still honors system preferences. */ }
  }
  apply()
  addEventListener('storage', apply)
  addEventListener('app-material-change', event => {
    if (event.detail === 'solid') document.documentElement.dataset.uiMaterial = 'solid'
    else if (event.detail === 'glass') delete document.documentElement.dataset.uiMaterial
    else apply()
  })
})()
