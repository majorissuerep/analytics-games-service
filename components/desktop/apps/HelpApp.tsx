import Link from 'next/link'
import { MaterialPreference } from '@/components/platform/MaterialPreference'
import './help-app.css'

export function HelpApp() {
  return (
    <div className="app-surface system-panel help-panel">
      <header className="help-masthead">
        <p className="help-edition">Analytics Games / Field guide</p>
        <h2>A little help, close at hand.</h2>
        <p>Find your way around the desktop.</p>
      </header>
      <div className="help-layout">
        <nav className="help-index" aria-label="Help topics">
          <a href="#help-desktop"><span>01</span> The desktop</a>
          <a href="#help-keyboard"><span>02</span> Keyboard</a>
          <a href="#help-appearance"><span>03</span> Appearance</a>
          <a href="#help-building"><span>04</span> Build a game</a>
        </nav>
        <div className="help-pages">
          <section className="help-card" id="help-desktop" aria-labelledby="help-desktop-title">
            <h3 id="help-desktop-title"><span>01</span> Make yourself at home</h3>
            <dl>
              <div className="help-reference-row"><dt>Open</dt><dd>Double-click a desktop icon, or choose a game from Start.</dd></div>
              <div className="help-reference-row"><dt>Arrange</dt><dd>Drag a title bar to move a window. Double-click it to maximize or restore.</dd></div>
              <div className="help-reference-row"><dt>Put aside</dt><dd>Use Minimize in the title bar. Click the window’s taskbar button to return.</dd></div>
              <div className="help-reference-row"><dt>Close</dt><dd>Use Close in the title bar when you’re finished. Save your work first.</dd></div>
            </dl>
          </section>
          <section className="help-card" id="help-keyboard" aria-labelledby="help-keyboard-title">
            <h3 id="help-keyboard-title"><span>02</span> Keep your hands on the keys</h3>
            <dl>
              <div className="help-reference-row"><dt>Move focus</dt><dd><kbd>Tab</kbd> moves forward; <kbd>Shift</kbd> + <kbd>Tab</kbd> moves back.</dd></div>
              <div className="help-reference-row"><dt>Open an icon</dt><dd>Focus a desktop icon, then press <kbd>Enter</kbd> or <kbd>Space</kbd>.</dd></div>
              <div className="help-reference-row"><dt>Use controls</dt><dd>Press <kbd>Enter</kbd> on a link or button. Press <kbd>Space</kbd> to change a checkbox.</dd></div>
            </dl>
            <p className="help-note">Each game has its own controls. Look inside the game for instructions.</p>
          </section>
          <section className="help-card help-appearance" id="help-appearance" aria-labelledby="help-appearance-title">
            <h3 id="help-appearance-title"><span>03</span> Settle into the view</h3>
            <p>Prefer solid surfaces? Reduce transparency across the platform.</p>
            <MaterialPreference />
            <p className="help-note">Your choice is saved in this browser. System contrast and transparency settings also apply.</p>
          </section>
          <section className="help-card" id="help-building" aria-labelledby="help-building-title">
            <h3 id="help-building-title"><span>04</span> Bring your own game</h3>
            <p>Have a web game to share? The developer guide walks through hosting, connecting, and registering it.</p>
            <div className="help-links">
              <Link href="/develop">Open full developer guide →</Link>
              <Link href="/design-system">Explore the Prism design system →</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
