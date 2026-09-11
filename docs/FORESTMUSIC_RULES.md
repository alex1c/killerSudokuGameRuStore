# Киллер Судоку — суммы

Offline-first Killer Sudoku for Android / RuStore.

**GitHub is the source of truth.**

## Paths

| Role | Path |
| --- | --- |
| Remote Cursor | `D:\PetProject\killerSudokuGameRuStore` |
| Local Codex/AVD | `D:\petProject\killerSudokuGameRuStore` |
| GitHub (source of truth) | https://github.com/alex1c/killerSudokuGameRuStore |

## Product

- App name: **Киллер Судоку**
- Subtitle: **Судоку с суммами**
- Package: `com.calculatorplatform.killersudoku`
- Version: `1.0.0` / versionCode `1`

## Stack

- Expo SDK 57
- React Native 0.86.x
- React 19.x
- TypeScript strict
- Jest + ESLint
- Android-first, offline-first
- No server / Unity / Skia in Phase 1

## Phase 1 scope

Foundation + mathematical engine only:

- seeded RNG
- classic Sudoku solver / solution counter
- solved-board generator
- Killer cage model + generator
- cage combinations
- Killer validator
- Killer solver + uniqueness check
- full Killer puzzle generator
- stress suite

Not in Phase 1: РСЯ, AppMetrica, navigation, Daily Challenge UI, stats, ads, smart hints, human difficulty grader, Skia, release signing.

## Killer Sudoku rules (engine)

- Classic Sudoku constraints: rows, columns, 3×3 boxes
- Board partitioned into orthogonally connected cages
- Each cage has a target sum
- Digits inside a cage never repeat
- Phase 1 puzzles prefer cage-only boards; minimal givens may remain for uniqueness
- Uniqueness is verified under Killer constraints (cages + remaining givens)

## Seed model

All generators use `createSeededRandom(seed)`.

- Same seed + same parameters ⇒ same puzzle
- Different seeds usually produce different boards / cages
- Intended for future Daily Challenge reproducibility

## Architecture

```text
src/
  app/                 # app constants / thin shell helpers
  game/
    sudoku/            # classic types, solver, solved-board generator
    killer/            # cages, combinations, validator, solver, generator
    difficulty/        # preset foundation only (not human grader)
  storage/             # minimal pure storage abstraction
  utils/               # seeded RNG helpers
```

`src/game/**` is pure TypeScript (no React Native APIs) so it can be tested and stressed in Node.

## Scripts

```bash
npm start
npm test
npm run typecheck
npm run lint
npm run test:engine:stress
```

Stress options:

```bash
# default: 250 puzzles
npm run test:engine:stress

# custom count / base seed
set KILLER_STRESS_COUNT=250
set KILLER_STRESS_SEED=900000
npm run test:engine:stress
```

Stress summary fields: `generated`, `validated`, `unique`, `failed`, `elapsed`.
Any invalid / non-unique puzzle ⇒ non-zero exit code.

## ForestMusic operating rules

### Signing

Production keystore is **not** created by Cursor.

Future local path only:

`D:\secure\android-signing\killerSudokuGameRuStore\`

Never invent keystore / alias / password. Never commit secrets.

### Emulator

Prefer a fast AVD for ordinary visual QA later.
Do not use heavy Pixel_10 / API 37 unless a rare native/release checkpoint requires it.

### Metro

**one project → one Metro**. Do not run multiple Metro instances for the same app.

### Real device

AVD does not replace final lower safe-area verification.

Before release, verify on a real Android device:

- number pad
- Undo
- Notes
- Erase
- Hint
- bottom sheets
- CTA
- gesture / navigation bar

### Learning

Roadmap always includes a full in-app section: **Обучение**. Do not remove it from future plans.

## License

Private ForestMusic project unless otherwise stated.
