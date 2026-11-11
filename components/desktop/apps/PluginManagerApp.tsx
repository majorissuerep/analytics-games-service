'use client'

import { DESKTOP_PLUGINS } from '@/plugins/registry'
import './plugin-manager-app.css'

const pluginDescriptions: Record<string, string> = {
  'paperclip-assistant': 'Ask Pip for help finding games and using the desktop.',
}

export function PluginManagerApp({ plugins, setPlugin }: { plugins: Record<string, boolean>; setPlugin(id: string, enabled: boolean): void }) {
  const enabledCount = DESKTOP_PLUGINS.filter((plugin) => plugins[plugin.manifest.id]).length

  return (
    <div className="app-surface system-panel plugin-manager">
      <header className="plugin-manager-heading">
        <p className="plugin-manager-eyebrow">Desktop preferences</p>
        <h2>Installed desktop plugins</h2>
        <p>Choose the extras that make this desktop yours.</p>
      </header>
      <div className="plugin-manager-summary">
        <strong role="status">{enabledCount} of {DESKTOP_PLUGINS.length} enabled</strong>
        <span>Changes apply immediately</span>
      </div>
      <div className="plugin-manager-list" role="group" aria-label="Installed plugins">
        {DESKTOP_PLUGINS.map((plugin) => {
          const enabled = Boolean(plugins[plugin.manifest.id])
          const descriptionId = `plugin-description-${plugin.manifest.id}`
          return (
            <label className="plugin-row" data-enabled={enabled} key={plugin.manifest.id}>
              <span className="plugin-manager-copy">
                <strong>{plugin.manifest.title}</strong>
                <small id={descriptionId}>{pluginDescriptions[plugin.manifest.id] ?? plugin.manifest.description}</small>
                <span className="plugin-manager-version">Version {plugin.manifest.version}</span>
              </span>
              <span className="plugin-manager-control">
                <input
                  type="checkbox"
                  aria-label={plugin.manifest.title}
                  aria-describedby={descriptionId}
                  checked={enabled}
                  onChange={(event) => setPlugin(plugin.manifest.id, event.target.checked)}
                />
                <span className="plugin-manager-state" aria-hidden="true">{enabled ? 'Enabled' : 'Disabled'}</span>
              </span>
            </label>
          )
        })}
      </div>
      <p className="plugin-manager-footnote">Your choices are saved in this browser. Disabled plugins stay installed.</p>
    </div>
  )
}
