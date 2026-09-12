# Киллер Судоку — суммы

Offline-first Killer Sudoku for Android / RuStore (ForestMusic).

**GitHub is the source of truth.**

## Paths

| Role | Path |
| --- | --- |
| Remote Cursor | `D:\PetProject\killerSudokuGameRuStore` |
| Local Codex/AVD | `D:\petProject\killerSudokuGameRuStore` |
| GitHub (source of truth) | https://github.com/alex1c/killerSudokuGameRuStore |

Branch: `main`

## Product

- **Name:** Киллер Судоку
- **Subtitle:** Судоку с суммами
- **Package:** `com.calculatorplatform.killersudoku`
- **Version:** `1.0.0`
- **versionCode:** `1`

## Stack

- Expo SDK 57
- React Native 0.86.x
- React 19.x
- TypeScript strict
- Jest + ESLint
- `@react-native-async-storage/async-storage` for active-game Continue
- Android / offline-first
- No server, Unity, or Skia

## Phase status

| Phase | Status |
| --- | --- |
| 1 Engine | PASS |
| 2 Board UI | PASS WITH FIXES |
| 3 Core gameplay | PASS WITH FIXES |
| 4 Home / Save / Difficulty | in progress → review |

## Phase 4 — product shell

- **Home** screen (no puzzle generation on first launch)
- **Continue** restores the full saved puzzle (cages, givens, values, notes, elapsed)
- **Autosave** after value/notes/erase/undo, on AppState background, and ~30s timer snapshots
- **New Game** → Easy / Medium / Hard / Expert → loading → play
- Versioned save schema `SavedGameV1` (`schemaVersion: 1`)
- Corrupt / unknown schema saves are ignored safely
- Completed games clear the active save (no Continue for finished games)
- Undo history is **not** persisted after restore (v1 limitation)

### Difficulty presets (generation knobs only)

Presets change cage-size weights, dig depth (`maxEmptyCells`), and solver node budgets.

They are **not** a proven human difficulty grader. A real human-difficulty phase comes later. `Master` is intentionally not offered in the UI yet.

### Generator performance

Generation was profiled and optimized (capped dig depth, softer uniqueness node budgets, skip redundant final full re-solve).

```bash
npm run profile:generator
npm run test:engine:stress
npm run test:engine:stress:difficulty
```

Target on a development PC: median ideally &lt; 2s, p90 ideally &lt; 5s; no systematic tens-of-seconds waits.

## Killer Sudoku rules

- Standard Sudoku: unique digits in every row, column, and 3×3 box
- The grid is partitioned into orthogonally connected **cages**
- Each cage has a **sum** equal to the sum of its solution digits
- Digits **never repeat** inside a cage
- Puzzles prefer **cage-only** boards when uniqueness allows
- When cage layout alone is not unique, the generator keeps a **minimal set of givens** (capped by preset)
- Uniqueness is always verified under **Killer constraints** (cages + remaining givens)

## Seed model

Use `createSeededRandom(seed)` for all generation.

- Same seed + same parameters → same result
- Seed is fixed at New Game and preserved across save/restore

Example:

```ts
import { generateKillerPuzzle } from './src/game/killer'

const puzzle = generateKillerPuzzle({
	seed: 20260911,
	difficultyPreset: 'medium',
})
```

## Architecture

```text
src/
  app/                 # constants / thin app helpers
  gameplay/            # pure game state (reducer/selectors/timer)
  game/
    sudoku/            # classic board types, solver, solved generator
    killer/            # cages, combinations, validator, solver, generator
    difficulty/        # generation presets (not human difficulty grader)
  ui/                  # Home, Difficulty, Game screens
  theme/               # light theme tokens
  storage/             # SavedGameV1 + AsyncStorage repository
  utils/               # seeded RNG
```

`src/game/**` and `src/gameplay/**` are pure TypeScript and independent from React Native APIs.

## Commands

```bash
npm start
npm test
npm run typecheck
npm run lint
npm run test:engine:stress
npm run test:engine:stress:difficulty
npm run profile:generator
```

### Stress tests

- `test:engine:stress` — default **250** puzzles
- `test:engine:stress:difficulty` — **100** per Easy/Medium/Hard/Expert (400 total)

Optional env:

- `KILLER_STRESS_COUNT` / `KILLER_STRESS_SEED`
- `KILLER_STRESS_PER_PRESET`
- `KILLER_PROFILE_SEEDS`

## ForestMusic rules

See [docs/FORESTMUSIC_RULES.md](docs/FORESTMUSIC_RULES.md) for signing, emulator, Metro, real-device QA, and Learning roadmap constraints.

Highlights:

- Production keystore is created only by the user locally
- Future signing path: `D:\secure\android-signing\killerSudokuGameRuStore\`
- one project → one Metro
- AVD does not replace real-device bottom safe-area checks
- Prefer AVD `ForestMusic_Fast_API35` for Android smoke
- In-app **Обучение** remains on the roadmap

## Known limitations

- Difficulty presets are **generation profiles**, not a proven human difficulty grader
- Puzzle boards prefer cage-only clues; some givens may remain for uniqueness
- Undo history resets after Continue restore
- No Hint / Daily / stats / ads / AppMetrica / Master difficulty / dark theme yet
- Conflicts are explicit-rule only mid-game (solution checked only at completion)
- Cage borders use inset solid lines (RN dashed borders are unreliable)
