# Consensus Radar

A Wavelength-style calibration game, ported to the latest upstream rules
(Bezushchak/consensus-radar) and integrated into the platform room engine.

- Rotating clue-giver (fewest turns, join-order ties) sees a secret target (5–95) on a keyed scale and gives a clue with **no digits**.
- Teammates each lock a marker; the team's answer is the average (0.1 precision). Bands: ≤5 → +5, ≤12 → +3, ≤40 → 0, further → −2.
- Rival teams place **side bets** on which side of the target the marker lands; a majority-correct team earns +1.
- The round auto-reveals once everyone who can act has acted; the host or clue-giver can force it. Play continues until a team reaches the goal (15/20/25/30) or endlessly, and the host can end the game at any point.

`server.ts` owns the rules through the `ServerGame` contract; `model.ts` holds the pure helpers; `scales.ts` is the 26-scale keyed catalogue (general + analytics, UK/EN). `server.test.ts` covers scoring, bets, rotation, secrecy projections, and the finish flow.
