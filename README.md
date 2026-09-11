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
- Android / offline-first
- No server, Unity, or Skia in Phase 1

## Phase 1 scope

Mathematical foundation only:

1. Seeded RNG
2. Classic Sudoku solver + solution counter
3. Solved-board generator
4. Killer cage model + generator
5. Cage combinations
6. Killer validator
7. Killer solver + uniqueness
8. Full Killer puzzle generator
9. Automated tests + stress suite

UI is intentionally minimal:

```text
Киллер Судоку
Математическое ядро готово
Phase 1
```

## Killer Sudoku rules

- Standard Sudoku: unique digits in every row, column, and 3×3 box
- The grid is partitioned into orthogonally connected **cages**
- Each cage has a **sum** equal to the sum of its solution digits
- Digits **never repeat** inside a cage
- Phase 1 puzzles prefer **cage-only** boards (empty starting grid)
- When cage layout alone is not unique, the generator keeps a **minimal set of givens**
- Uniqueness is always verified under **Killer constraints** (cages + remaining givens)

## Seed model

Use `createSeededRandom(seed)` for all generation.

- Same seed + same parameters → same result
- Enables future Daily Challenge reproducibility

Example:

```ts
import { generateKillerPuzzle } from './src/game/killer'

const puzzle = generateKillerPuzzle({ seed: 20260911 })
```

## Architecture

```text
src/
  app/                 # constants / thin app helpers
  game/
    sudoku/            # classic board types, solver, solved generator
    killer/            # cages, combinations, validator, solver, generator
    difficulty/        # preset foundation (not human difficulty grader)
  storage/             # minimal pure storage abstraction
  utils/               # seeded RNG
```

`src/game/**` is pure TypeScript and independent from React Native APIs.

## Commands

```bash
npm start
npm test
npm run typecheck
npm run lint
npm run test:engine:stress
```

### Stress test

```bash
npm run test:engine:stress
```

Default target: **250** puzzles.

Optional env:

- `KILLER_STRESS_COUNT`
- `KILLER_STRESS_SEED`

Printed summary:

```text
generated
validated
unique
failed
elapsed
```

Any invalid / non-unique puzzle fails the process (non-zero exit code).

## ForestMusic rules

See [docs/FORESTMUSIC_RULES.md](docs/FORESTMUSIC_RULES.md) for signing, emulator, Metro, real-device QA, and Learning roadmap constraints.

Highlights:

- Production keystore is created only by the user locally
- Future signing path: `D:\secure\android-signing\killerSudokuGameRuStore\`
- one project → one Metro
- AVD does not replace real-device bottom safe-area checks
- In-app **Обучение** remains on the roadmap

## Known Phase 1 limitations

- Difficulty presets tune cage-size weights only; they are **not** a final human difficulty grader
- Puzzle boards prefer cage-only clues; a few givens may remain when needed for uniqueness
- No gameplay UI beyond the Phase 1 status screen
- No ads / analytics / backup / Daily Challenge UI yet
