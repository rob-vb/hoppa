# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start development server (opens options for iOS, Android, web)
npx expo start

# Platform-specific
npx expo start --ios
npx expo start --android
npx expo start --web

# Lint
npm run lint
```

## Architecture

Hoppa is a fitness workout tracking app built with Expo Router, NativeTabs, Zustand, and SQLite.

### Routing Structure
- `app/_layout.tsx` - Root layout with NativeTabs (Home, Schemas, History)
- `app/(home)/` - Home tab with workout day cards
- `app/(schemas)/` - Schema management (list, create, details)
- `app/(history)/` - Workout history
- `app/workout/[dayId].tsx` - Active workout session (fullscreen modal)

Each tab group has its own Stack navigator for screen headers.

### Path Aliases
Use `@/` to import from the project root:
```typescript
import { useSchemaStore } from '@/stores/schema-store';
import { calculatePlates } from '@/utils/plate-calculator';
```

### State Management (Zustand)
- `stores/schema-store.ts` - Workout schemas CRUD, synced with SQLite
- `stores/workout-store.ts` - Active workout session, rep logging, progression

### Database (SQLite)
- `db/database.ts` - All database operations
- Tables: `schemas`, `workout_days`, `exercises`, `workout_sessions`, `exercise_logs`, `set_logs`

### Utilities
- `utils/plate-calculator.ts` - Calculate plate combinations for target weight
- `utils/progression-engine.ts` - Check if progression is earned, calculate new weights

### Components
- `components/ui/workout-day-card.tsx` - Card for selecting a workout day
- `components/ui/schema-card.tsx` - Card for schema list
- `components/ui/exercise-card.tsx` - Full exercise card during workout
- `components/ui/plate-visualizer.tsx` - Visual barbell plate breakdown
- `components/ui/rep-input.tsx` - Set rep input with quick buttons

### Data Flow
1. User creates schema with days and exercises via `(schemas)/create.tsx`
2. Schema is stored in SQLite via `schema-store.ts`
3. User starts workout from Home or Schema details
4. `workout-store.ts` creates a session and exercise logs
5. User logs reps, finishes/skips exercises
6. Progression engine checks if weight should increase
7. Session is completed and saved to history

### Key Patterns
- Icons use SF Symbols via `expo-symbols` (SymbolView component)
- All screens use `contentInsetAdjustmentBehavior="automatic"` for safe area
- Haptic feedback on iOS for user interactions
- Dark theme throughout (background: #1C1C1E, surface: #2C2C2E)

### Configuration
- `app.json` - Expo config with `newArchEnabled: true`, `typedRoutes: true`, `reactCompiler: true`
- TypeScript strict mode enabled
- ESLint uses expo flat config
