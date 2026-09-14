# Decision: isolate The Powder Toy as a GPLv3 WebAssembly component

- Status: Accepted
- Date: 2026-08-30
- Scope: Powder Toy game integration
- Review gate: Legal review before public or desktop distribution

## Context

The new falling-sand game needs mature pressure, heat, gravity, material interaction, electronics, save, and scripting systems. The Powder Toy already provides those systems and describes itself as a physics sandbox distributed under the GNU General Public License.[1][2]

The upstream Meson build detects Emscripten and defines a WebAssembly output path with SDL2, browser filesystem support, and IndexedDB persistence.[3] Reimplementing or translating the engine would add large technical and licensing risk without improving the product boundary.

## Decision

Use an exact, pinned upstream revision of The Powder Toy. Build its source without patches through its supported Emscripten path. Ship the result as a distinct GPLv3 component.

The proprietary launcher will treat Powder Toy as a separate browser application:

- host it under a dedicated static path;
- open it in the existing game iframe model;
- keep its JavaScript, WebAssembly, assets, licence, notices, and corresponding source separate from launcher bundles;
- use only a narrow, documented browser boundary for lifecycle, focus, resize, and coarse telemetry;
- do not link launcher modules into Powder Toy or expose Powder Toy internal data structures to launcher code;
- do not make Powder Toy depend on proprietary simulation or service code.

The iframe boundary is an engineering control. It does not by itself settle whether a distribution is an aggregate under copyright law. Counsel must review the final packaging and communication boundary. The GNU GPL FAQ distinguishes an aggregate from a combined work based on both the communication mechanism and the semantics of that communication.[4]

## Source-change policy

The default and accepted release has no Powder Toy source changes.

Allowed outside the upstream source tree:

- reproducible build scripts and pinned toolchains;
- supported Meson options and compiler flags;
- wrapper HTML and static routing;
- iframe host code;
- HTTP headers;
- licence, notice, provenance, and checksum files;
- a host adapter that observes or relays stable browser-level lifecycle signals without using engine internals.

If a source patch becomes unavoidable, stop this implementation. Record the need as a new decision. Any approved patch remains GPLv3 and must ship in the corresponding source. Do not use source-guided AI translation or rewriting to claim a new proprietary engine; changing language or structure does not remove obligations attached to a derivative work.[4]

## Distribution and provenance rules

Each shipped build must record:

- upstream repository URL;
- exact commit SHA and tag, when applicable;
- complete GPLv3 licence text;
- source archive or durable corresponding-source location for the exact binary;
- build commands, build scripts, toolchain versions, and dependency versions needed to reproduce it;
- confirmation that the patch set is empty;
- SHA-256 hashes for shipped JavaScript, WebAssembly, assets, licence, and source archive;
- copyright and third-party notices required by upstream.

The GPLv3 defines Corresponding Source to include the source and scripts needed to generate, install, run, and modify object code.[1] A floating link to the upstream default branch is not enough for a pinned shipped binary.

## Network and branding policy

Build or launch Powder Toy with upstream network features disabled through supported options. Do not connect to upstream accounts, saves, updates, forums, or community services unless a later decision approves the dependency. Upstream documents a `disable-network` launch option.[2]

Use product-owned naming and outer-shell branding. Keep required Powder Toy attribution and legal notices. Do not imply endorsement by the upstream project. Any use of upstream names, logos, community content, or services needs separate review.

## WebAssembly isolation risk

The first implementation step is a build spike, not a global header change.

1. Build and boot the exact upstream Emscripten target.
2. Determine from the produced artifacts and runtime whether it uses WebAssembly threads.
3. If threads are required, test a route-scoped cross-origin-isolated deployment.
4. If upstream supports a single-threaded build through flags, build and benchmark it under the same workload.
5. Choose between those builds only after browser compatibility and performance evidence exists.

WebAssembly threads require `SharedArrayBuffer`. Browser cross-origin isolation commonly needs `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`; those headers can block resources that have not opted in.[5] Do not enable them globally before testing analytics, external games, cross-origin assets, popups, and every existing game route.

## Consequences

Benefits:

- preserves Powder Toy's mature simulation and UI;
- avoids a new engine rewrite;
- keeps the GPL-covered artifact and compliance material visible;
- fits the existing static `launchPath` and iframe architecture;
- keeps launcher integration small.

Costs and limits:

- the Powder Toy component remains GPLv3;
- distribution needs exact corresponding-source and notice handling;
- the host boundary and packaged desktop form need legal review;
- upstream UI changes are not part of the accepted design;
- browser threading may force route-specific isolation or a slower supported build;
- upstream online services are unavailable by default.

## Validation gates

Implementation is not releasable until all gates pass:

- clean checkout at the recorded SHA builds with the recorded command;
- generated WASM boots in the supported browsers;
- iframe launch, focus, resize, close, and reload work;
- no request reaches Powder Toy upstream services;
- legal notices and corresponding source are reachable from the game and product licence view;
- shipped bytes match recorded hashes;
- no Powder Toy source patch exists;
- route headers do not break existing games, analytics, assets, or popup flows;
- counsel approves the distribution boundary.

This decision is an engineering policy, not legal advice.

## Sources

[1] https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/LICENSE — The Powder Toy LICENSE
[2] https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/README.md — The Powder Toy README
[3] https://raw.githubusercontent.com/The-Powder-Toy/The-Powder-Toy/master/meson.build — The Powder Toy Meson build
[4] https://www.gnu.org/licenses/gpl-faq.html — GNU GPL FAQ
[5] https://web.dev/articles/coop-coep — Cross-origin isolation with COOP and COEP
