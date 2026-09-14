# Upstream Pinball

Vendored from `https://github.com/lrusso/Pinball` at commit
`fcf63f97d24467248fe1eaa89adaf273209f3da2`.

Files preserved:

- `PinballGame.htm` — byte-identical to upstream except for one clearly
  marked platform integration block appended **after** the closing `</html>`
  (see below).
- `PinballGame.js` — byte-identical to upstream, never modified.

The upstream repository describes the game as based on the Phaser 2 Box2D
pinball example. The upstream repository does not declare a software license.
These files are intentionally kept separate from platform source so their
origin remains explicit and they can be updated or replaced independently.

Local integration changes: none inside the two upstream runtime files.
`PinballGame.htm` carries one appended platform integration block after the
closing `</html>` tag (clearly delimited by a comment): it makes the frame
ping `pinball:menu-ready` to the cabinet chrome so the branded loader hides
only when the game is actually visible, and it listens for
`{ pinballSound: boolean }` messages from the cabinet and reflects them onto
the upstream `GAME_SOUND_ENABLED` global and Phaser's sound manager. All
other platform integration (scaling, loader UI, persistent mute, exit) lives
in the platform-owned cabinet files (`cabinet.html`, `cabinet.css`,
`cabinet.js`, `cabinet-core.js`).
