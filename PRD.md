# Product Requirements Document
## Hoppa

**Version:** 1.0 (MVP)
**Date:** January 2025
**Status:** Draft

---

## Tasks

### Phase 1: MVP (Free Tier) - ~7.5 weeks

#### Setup & Foundation (1 week)
- [x] Set up project structure with proper path aliases (`@/`)
- [x] Configure NativeTabs navigation (Home, Schemas, History)
- [x] Create tab group layouts with Stack navigators
- [x] Set up dark theme (background: #1C1C1E, surface: #2C2C2E)
- [x] Create base UI components (buttons, inputs, cards)
- [x] Set up SQLite database with expo-sqlite
- [x] Create database schema (schemas, workout_days, exercises, workout_sessions, exercise_logs, set_logs)

#### Schema Management (1.5 weeks)
- [x] Create Zustand schema store with SQLite sync
- [x] Build schema list screen `(schemas)/index.tsx`
- [x] Build schema creation screen `(schemas)/create.tsx`
- [x] Implement workout day management (add, edit, reorder, delete)
- [x] Implement exercise management within days
- [x] Add equipment type selector (plates/machine/other)
- [x] Add base weight input
- [x] Add target sets and rep range inputs
- [x] Add progressive loading toggles (schema-level and exercise-level)
- [x] Add progression increment selector (2.5kg/5kg/custom)
- [x] Build schema details/edit screen `(schemas)/[id].tsx`
- [x] Build schema card component for list view

#### AI Schema Import (1 week)
- [x] Set up Claude API integration
- [x] Build image picker flow (camera/gallery)
- [x] Create AI prompt for schema extraction
- [x] Parse AI response into schema structure
- [x] Build review/edit screen for extracted schema
- [x] Add rate limiting (3 imports/month for free tier)
- [x] Handle error states (unclear image, partial extraction, API errors)

#### Workout Execution (2 weeks)
- [x] Create Zustand workout store
- [x] Build home screen with workout day cards `(home)/index.tsx`
- [x] Show "last workout" date on day cards
- [x] Build active workout screen `workout/[dayId].tsx` (fullscreen modal)
- [x] Create exercise card component with current exercise display
- [x] Build plate calculator utility (`utils/plate-calculator.ts`)
- [x] Create plate visualizer component (visual barbell breakdown)
- [x] Distinguish gym plates vs personal microplates in visualization
- [x] Build rep input component with large touch targets
- [x] Implement quick rep buttons
- [x] Add auto-advance to next set after input
- [x] Show visual feedback (checkmark) when rep meets target
- [x] Implement Skip exercise functionality
- [x] Implement Finish exercise functionality
- [x] Show workout progress bar (exercise X of Y)
- [x] Add workout timer display
- [x] Implement End Workout flow
- [x] Add haptic feedback for interactions (iOS)

#### Progression Engine (1 week)
- [x] Build progression engine utility (`utils/progression-engine.ts`)
- [x] Check schema-level progressive loading toggle
- [x] Check exercise-level progressive loading toggle
- [x] Implement progression rule: all sets must hit max target reps
- [x] Calculate and display "progression earned" feedback
- [x] Auto-update exercise currentWeight on progression
- [x] Show next session's weight after progression

#### History & Polish (1 week)
- [x] Build history tab `(history)/index.tsx`
- [x] Show last 30 days of workouts
- [x] Display workout summary (date, schema, day, duration)
- [x] Show exercise logs with sets/reps
- [x] Indicate progressions earned per workout
- [x] Bug fixes and edge case handling
- [x] Performance optimization
- [x] Comprehensive testing

---

### Phase 2: Premium Features - ~7 weeks

#### Convex Setup (0.5 weeks)
- [x] Set up Convex project
- [x] Define Convex schema (users, schemas, workoutDays, exercises, workoutSessions, exerciseLogs, setLogs)
- [x] Create basic queries and mutations
- [x] Set up indexes for common queries

#### Authentication (1 week)
- [x] Integrate Convex Auth
- [x] Implement Email + Password login
- [x] Implement Google OAuth
- [x] Implement Apple Sign-In
- [x] Build auth store (Zustand)
- [x] Update existing auth screens to use Convex Auth
- [x] Add account management (profile, logout)
- [x] Handle auth state persistence

#### Sync Engine (1.5 weeks)
- [x] Build sync engine utility (`utils/sync-engine.ts`)
- [x] Implement initial sync (upload local SQLite to Convex)
- [x] Implement real-time sync via Convex subscriptions
- [x] Handle conflict resolution (last-write-wins with timestamps)
- [x] Implement offline queue for mutations
- [x] Sync when coming back online
- [x] Add localId fields for SQLite ↔ Convex mapping

#### Progress Dashboard (2 weeks)
- [x] Build dashboard tab `(tabs)/dashboard.tsx` (replace placeholder)
- [x] Create overview cards (workouts, progressions, volume)
- [x] Build exercise selector with search
- [x] Create exercise progress chart (weight over time)
- [x] Show starting weight → current weight comparison
- [x] Display progression count and average time between
- [x] Build workout calendar view
- [x] Implement Convex queries for progress data
- [x] Add date range filters (last month, 3 months, 6 months, year)

#### Subscription (1 week)
- [x] Integrate RevenueCat SDK
- [x] Build paywall UI
- [x] Implement monthly subscription (€4.99)
- [x] Implement annual subscription (€39.99)
- [x] Handle purchase flow (App Store / Google Play)
- [x] Update isPremium flag in Convex on purchase
- [x] Gate premium features behind subscription check
- [x] Handle subscription expiration/renewal

#### Testing & Polish (1 week)
- [ ] Test offline scenarios
- [ ] Test sync edge cases
- [ ] Test subscription flows
- [ ] Performance optimization
- [ ] Bug fixes

---

### Phase 3: Personal Trainer Platform - ~12 weeks

#### Web App Setup (1 week)
- [ ] Create Next.js 14 project (App Router)
- [ ] Set up Tailwind CSS
- [ ] Configure Convex for web
- [ ] Implement trainer authentication
- [ ] Build basic layout (sidebar, header)
- [ ] Create landing page

#### Trainer Onboarding (1 week)
- [ ] Build trainer registration flow
- [ ] Create trainers table in Convex
- [ ] Integrate Stripe for subscriptions
- [ ] Implement tier selection (Starter/Pro/Studio)
- [ ] Build subscription management UI
- [ ] Handle upgrade/downgrade flows

#### Client Management (1.5 weeks)
- [ ] Build client invitation system (email)
- [ ] Create trainerClients table in Convex
- [ ] Generate invite tokens
- [ ] Build invite acceptance flow in mobile app
- [ ] Create client list view with status indicators
- [ ] Implement client states (invited, active, paused, archived)
- [ ] Build client card component
- [ ] Add client search and filtering

#### Schema Builder - Web (2 weeks)
- [ ] Build drag-and-drop schema builder
- [ ] Create exercise library with search
- [ ] Implement day management (add, reorder, delete)
- [ ] Implement exercise management within days
- [ ] Add all exercise fields (equipment, weight, sets, reps, progression)
- [ ] Add exercise notes field (form cues)
- [ ] Build template save/load functionality
- [ ] Create schemaTemplates table in Convex
- [ ] Implement multi-client assignment
- [ ] Create schemaAssignments table in Convex

#### Client Sync (1 week)
- [ ] Set up Expo Push Notifications
- [ ] Send push notification on schema assignment
- [ ] Build "new schema received" screen in mobile app
- [ ] Sync assigned schemas to client's local database
- [ ] Show trainer branding in client app
- [ ] Display "Assigned by [Trainer]" on schemas

#### Progress Dashboard - Trainer View (2 weeks)
- [ ] Build client detail view
- [ ] Create overview cards (workouts, volume, progressions, adherence)
- [ ] Build multi-exercise progress chart
- [ ] Create recent activity feed
- [ ] Show workout details (exercises, sets, reps, skipped)
- [ ] Highlight progressions earned
- [ ] Add workout calendar for client
- [ ] Build adherence tracking (sessions completed vs expected)

#### Payment Collection (2 weeks)
- [ ] Integrate Stripe Connect
- [ ] Build Stripe onboarding flow for trainers
- [ ] Create clientPayments table in Convex
- [ ] Implement billing configuration per client
- [ ] Support billing types (monthly, per-session, package)
- [ ] Build invoicing system
- [ ] Create payment reminders
- [ ] Build billing dashboard for trainers
- [ ] Calculate and display platform fees
- [ ] Handle payouts to trainer accounts

#### Testing & Polish (1.5 weeks)
- [ ] End-to-end testing (web + mobile)
- [ ] Test payment flows
- [ ] Test schema delivery
- [ ] Mobile responsiveness for web dashboard
- [ ] Documentation
- [ ] Bug fixes

---

## 1. Executive Summary

Hoppa is a mobile fitness application designed to streamline workout logging and progressive overload tracking for strength training enthusiasts. The app replaces manual note-taking with a structured, intelligent system that automatically calculates weights, tracks plate configurations, and manages progressive loading based on user performance.

The primary goal is to eliminate the cognitive overhead of calculating weights during workouts while maintaining a clear record of progress. The app specifically supports users who use microplates for fine-grained progressive overload—a feature not commonly found in existing fitness apps.

---

## 2. Problem Statement

### 2.1 Current Pain Points

**Manual Calculations:** Users must mentally calculate total weight from base weight plus plates, often mid-workout when focus should be on training.

**Plate Configuration:** Figuring out which plates to use per side requires mental math that disrupts workout flow.

**Progressive Overload Tracking:** Determining when to increase weight based on completed sets and reps requires reviewing notes and remembering rules.

**Microplate Support:** Most apps don't account for microplates (0.25kg–1kg), forcing users to round up to standard increments and potentially stall progress.

**Unstructured Notes:** Using generic note apps for workout logging lacks structure, making historical analysis difficult.

### 2.2 Example of Current Workflow

The user currently tracks workouts in a notes app with entries like:

```
Dag 1
Incline Chest Press (58,8kg + 1kg)
7x7

Chest Press Machine (78,6kg)
5x5
```

This format requires the user to:
1. Remember that 58.8kg = 11.3kg bar + plates (20kg + 2.5kg + 1.25kg per side)
2. Track that "+1kg" represents a personal microplate
3. Mentally check if "7x7" (2 sets of 7 reps) meets the target for progression
4. Remember to add 2.5kg next session if targets were met

---

## 3. Product Vision

Hoppa will be the go-to app for strength athletes who follow structured progressive loading programs. The app will feel like having a knowledgeable training partner who handles all the logistics while you focus on lifting.

### 3.1 Core Value Propositions

1. **Zero Mental Math:** All weight calculations happen automatically, including plate-by-plate breakdown
2. **Automatic Progression:** The app knows your progression rules and automatically increases weight when earned
3. **Microplate First:** Built-in support for microplates enables smaller, more sustainable progress increments
4. **Quick Logging:** Log reps with minimal taps, designed for use between sets

---

## 4. Technical Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | React Native + Expo | Cross-platform, rapid development, OTA updates |
| Styling | NativeWind (Tailwind CSS) | Familiar utility-first styling, consistent design |
| State Management | Zustand | Lightweight, simple API, excellent performance |
| Local Storage | Expo SQLite | Offline-first, fast queries for workout data |
| Backend (Premium) | Convex | Real-time sync, serverless, TypeScript-native |
| Authentication | Convex Auth (or Clerk) | Seamless integration with Convex, social logins |
| AI Integration | Claude API (Anthropic) | Schema extraction from screenshots |
| Navigation | Expo Router | File-based routing, deep linking support |
| Camera | expo-image-picker | Screenshot capture for AI schema import |

### 4.1 Project Structure

```
src/
├── app/                    # Expo Router pages
│   ├── (tabs)/
│   │   ├── index.tsx       # Home / Today's workout
│   │   ├── schemas.tsx     # Schema management
│   │   ├── dashboard.tsx   # Progress dashboard (Premium)
│   │   └── history.tsx     # Workout history
│   ├── workout/
│   │   └── [dayId].tsx     # Active workout session
│   ├── schema/
│   │   ├── create.tsx      # Create new schema
│   │   └── [schemaId].tsx  # Edit schema
│   └── auth/
│       ├── login.tsx       # Login screen (Premium)
│       └── register.tsx    # Registration (Premium)
├── components/
│   ├── ExerciseCard.tsx
│   ├── RepInput.tsx
│   ├── PlateVisualizer.tsx
│   ├── ProgressChart.tsx   # Premium
│   └── ...
├── stores/
│   ├── workoutStore.ts     # Zustand store for active workout
│   ├── schemaStore.ts      # Zustand store for schemas
│   ├── progressStore.ts    # Zustand store for progression data
│   └── authStore.ts        # Zustand store for auth state
├── convex/                 # Convex backend (Premium)
│   ├── schema.ts           # Convex schema definitions
│   ├── workouts.ts         # Workout mutations & queries
│   ├── schemas.ts          # Schema mutations & queries
│   ├── progress.ts         # Progress aggregation queries
│   └── auth.ts             # Authentication config
├── utils/
│   ├── plateCalculator.ts  # Plate combination logic
│   ├── progressionEngine.ts
│   ├── aiSchemaParser.ts
│   └── syncEngine.ts       # SQLite <-> Convex sync
├── types/
│   └── index.ts
└── db/
    └── schema.ts           # SQLite schema definitions
```

---

## 5. Data Models

### 5.1 Schema

```typescript
interface Schema {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  progressiveLoadingEnabled: boolean;  // Master toggle for entire schema
  days: WorkoutDay[];
}

interface WorkoutDay {
  id: string;
  schemaId: string;
  name: string;           // e.g., "Day 1", "Chest Focused Upper"
  order: number;
  exercises: Exercise[];
}

interface Exercise {
  id: string;
  dayId: string;
  name: string;
  equipmentType: 'plates' | 'machine' | 'other';
  baseWeight: number;     // Bar weight or machine base (kg)
  targetSets: number;
  targetRepsMin: number;  // e.g., 6 for "6-8 reps"
  targetRepsMax: number;  // e.g., 8 for "6-8 reps"
  progressiveLoadingEnabled: boolean;  // Per-exercise override (only if schema allows)
  progressionIncrement: number;  // kg to add on success (2.5 or 5)
  order: number;
  currentWeight: number;  // Current working weight (excluding microplates)
}
```

**Progressive Loading Configuration:**

| Schema Setting | Exercise Setting | Behavior |
|----------------|------------------|----------|
| ✅ Enabled | ✅ Enabled | Auto-progression when targets hit |
| ✅ Enabled | ❌ Disabled | Fixed weight, no auto-progression |
| ❌ Disabled | (ignored) | All exercises fixed weight |

This allows for flexible scenarios:
- **Full progressive schema:** Both enabled (default)
- **Deload week:** Schema disabled → all exercises fixed
- **Mixed schema:** Schema enabled, but specific exercises (e.g., abs, cardio) disabled

### 5.2 Workout Session

```typescript
interface WorkoutSession {
  id: string;
  schemaId: string;
  dayId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: 'in_progress' | 'completed';
  exerciseLogs: ExerciseLog[];
}

interface ExerciseLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  status: 'pending' | 'completed' | 'skipped';
  sets: SetLog[];
  microplateUsed: number;  // Additional microplate weight (0, 0.25, 0.5, 0.75, 1)
  totalWeight: number;     // Calculated: baseWeight + plates + microplate
  progressionEarned: boolean;  // Did user hit all targets?
}

interface SetLog {
  setNumber: number;
  targetReps: string;     // e.g., "6-8"
  completedReps: number | null;
}
```

### 5.3 Available Plates Configuration

```typescript
interface PlateConfig {
  // Standard gym plates (per side)
  standardPlates: number[];  // [1.25, 2.5, 5, 10, 20]
  
  // User's personal microplates
  microplates: number[];     // [0.25, 0.5, 0.75, 1]
}
```

---

## 6. User Stories & Requirements

### 6.1 Schema Management

| ID | User Story | Priority |
|----|------------|----------|
| US-001 | As a user, I want to create a workout schema manually so that I can define my exercises, sets, and rep ranges | Must Have |
| US-002 | As a user, I want to upload a screenshot of my workout plan and have AI extract the schema so that I can quickly digitize my existing program | Must Have |
| US-003 | As a user, I want to specify the equipment type for each exercise (plates/barbell, machine, or other) so that the app calculates weights correctly | Must Have |
| US-004 | As a user, I want to set a base weight for each exercise (e.g., barbell weight of 11.3kg) so that total weight calculations are accurate | Must Have |
| US-005 | As a user, I want to configure the progression increment per exercise (2.5kg, 5kg, or custom) so that I can follow my preferred loading protocol | Must Have |

### 6.2 Workout Execution

| ID | User Story | Priority |
|----|------------|----------|
| US-006 | As a user, I want to start a workout day from my schema so that I can begin logging my session | Must Have |
| US-007 | As a user, I want to see the target weight for each exercise with a breakdown of which plates to load per side so that I don't have to calculate this myself | Must Have |
| US-008 | As a user, I want to log the reps completed for each set with minimal taps so that logging doesn't interrupt my workout flow | Must Have |
| US-009 | As a user, I want to skip an exercise if needed so that I can continue with my workout when equipment is unavailable | Must Have |
| US-010 | As a user, I want to complete and close a workout day so that my progress is saved and progression rules are applied | Must Have |

### 6.3 Progressive Loading

| ID | User Story | Priority |
|----|------------|----------|
| US-011 | As a user, I want the app to automatically increase my working weight when I've hit my target sets and reps so that I don't have to track this manually | Must Have |
| US-012 | As a user, I want to see whether I've earned a progression after completing an exercise so that I know my effort paid off | Should Have |
| US-013 | As a user, I want to manually override the suggested weight if needed so that I have control over my training | Should Have |

### 6.4 Microplate Support

| ID | User Story | Priority |
|----|------------|----------|
| US-014 | As a user, I want to specify additional microplate weight for an exercise so that I can make smaller increments than standard plates allow | Must Have |
| US-015 | As a user, I want the plate visualization to clearly distinguish between gym plates and my personal microplates so that I know what to bring | Should Have |

---

## 7. Feature Specifications

### 7.1 Schema Creation

#### 7.1.1 Manual Entry

**Screen:** Create Schema

**Schema-Level Settings:**
- Schema name (text input)
- Progressive loading (toggle, default: ON)
  - When OFF: hides progression settings for all exercises, shows info banner

**Fields per Exercise:**
- Exercise name (text input)
- Equipment type (segmented control: Plates / Machine / Other)
- Base weight in kg (numeric input, shown for Plates and Machine)
- Target sets (numeric stepper, 1-10)
- Target rep range (two numeric inputs: min and max)
- Progressive loading (toggle, default: ON) — only shown if schema has progressive loading enabled
- Progression increment (segmented control: 2.5kg / 5kg / Custom with input) — only shown if exercise progressive loading is ON

**Behavior:**
- When equipment type is "Other", base weight is automatically set to 0kg and disabled
- Default progression increment is 2.5kg
- Exercises can be reordered via drag-and-drop
- Schema must have at least one day with one exercise to be saved
- When schema progressive loading is OFF, a banner shows: "Progressive loading is disabled for this schema. Weights will remain fixed."

#### 7.1.2 AI Screenshot Import

**Flow:**
1. User taps "Import from Screenshot"
2. Camera/gallery picker opens
3. User selects or takes photo of their workout plan
4. Loading indicator while AI processes image
5. AI returns structured schema data
6. User reviews and edits extracted data
7. User confirms to save schema

**AI Prompt Structure:**
```
Analyze this workout schema image and extract:
- Day names/numbers
- Exercise names
- Number of sets
- Rep ranges (min-max)
- Any notes about equipment

Return as structured JSON matching this format:
{
  "days": [
    {
      "name": "Day 1",
      "exercises": [
        {
          "name": "Incline Chest Press",
          "sets": 2,
          "repsMin": 5,
          "repsMax": 7,
          "notes": "converging variant preferred"
        }
      ]
    }
  ]
}
```

### 7.2 Active Workout Session

#### 7.2.1 Exercise Card Component

```
┌─────────────────────────────────────────────────┐
│ Incline Chest Press                             │
│ ─────────────────────────────────────────────── │
│                                                 │
│ Target: 59.8kg                                  │
│ (Bar 11.3kg + Plates + 1kg microplate)          │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │     [PLATE VISUALIZATION]                   │ │
│ │                                             │ │
│ │  ┌───┬───┬───┐       ┌───┬───┬───┐          │ │
│ │  │1.25│2.5│20 ══════│20 │2.5│1.25│          │ │
│ │  └───┴───┴───┘  BAR  └───┴───┴───┘          │ │
│ │                                             │ │
│ │  + 1kg microplate (bring your own)          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Set 1 (5-7 reps)    [  7  ] ✓                   │
│ Set 2 (5-7 reps)    [  7  ] ✓                   │
│                                                 │
│ ┌──────────────────┐  ┌──────────────────┐      │
│ │      SKIP        │  │     FINISH       │      │
│ └──────────────────┘  └──────────────────┘      │
│                                                 │
│ ✨ Progression earned! +2.5kg next session      │
└─────────────────────────────────────────────────┘
```

#### 7.2.2 Rep Input Behavior

- Tap on rep input field to focus
- Numeric keyboard appears
- Large touch targets for gym use
- Auto-advance to next set after input
- Visual feedback (checkmark) when rep meets target range

#### 7.2.3 Finish vs Skip Logic

| Condition | Available Actions |
|-----------|-------------------|
| No sets logged | Skip only |
| Some sets logged | Skip or Finish |
| All sets logged | Finish (primary), Skip (secondary) |

### 7.3 Plate Calculator

#### 7.3.1 Algorithm

```typescript
function calculatePlates(
  targetWeight: number,
  baseWeight: number,
  availablePlates: number[] = [20, 10, 5, 2.5, 1.25]
): PlateResult {
  const weightPerSide = (targetWeight - baseWeight) / 2;
  const plates: number[] = [];
  let remaining = weightPerSide;
  
  // Greedy algorithm: use largest plates first
  for (const plate of availablePlates.sort((a, b) => b - a)) {
    while (remaining >= plate) {
      plates.push(plate);
      remaining -= plate;
    }
  }
  
  return {
    platesPerSide: plates,
    totalPlateWeight: (targetWeight - baseWeight),
    achievable: remaining < 0.01  // Float tolerance
  };
}
```

#### 7.3.2 Microplate Handling

Microplates are tracked separately and displayed distinctly in the UI:

- Standard gym plates: Shown in plate visualization with dark colors
- Microplates: Shown with accent color and "bring your own" label
- Microplate selection: User can adjust per exercise during workout

### 7.4 Progression Engine

#### 7.4.1 Progression Rules

```typescript
function checkProgression(
  exerciseLog: ExerciseLog, 
  exercise: Exercise,
  schema: Schema
): boolean {
  // Check if progressive loading is enabled at schema level
  if (!schema.progressiveLoadingEnabled) return false;
  
  // Check if progressive loading is enabled for this specific exercise
  if (!exercise.progressiveLoadingEnabled) return false;
  
  // All sets must be completed (not skipped)
  if (exerciseLog.status !== 'completed') return false;
  
  // Check if ALL sets hit the MAXIMUM target reps
  // e.g., for "5-7 reps", user must hit 7 reps on every set to progress
  const allSetsHitMaxTarget = exerciseLog.sets.every(
    set => set.completedReps !== null && 
           set.completedReps >= exercise.targetRepsMax
  );
  
  return allSetsHitMaxTarget;
}

function applyProgression(exercise: Exercise, earned: boolean): void {
  if (earned) {
    exercise.currentWeight += exercise.progressionIncrement;
  }
}
```

#### 7.4.2 Progression Display

When a user finishes an exercise:
- If progression earned: Show success message with next session's weight
- If not earned: Show encouragement, weight stays the same

---

## 8. User Interface Specifications

### 8.1 Navigation Structure

```
Tab Bar
├── Home (Today's Workout)
│   └── Active Workout Session
├── Schemas
│   ├── Schema List
│   ├── Create Schema
│   │   └── AI Import
│   └── Edit Schema
└── History (Post-MVP)
```

### 8.2 Design Principles

1. **Large Touch Targets:** Minimum 48x48dp for all interactive elements
2. **High Contrast:** Easy to read in various gym lighting conditions
3. **Minimal Scrolling:** Key information visible without scrolling during sets
4. **Quick Actions:** Most common actions require ≤2 taps
5. **Clear Feedback:** Visual and optional haptic feedback for all inputs

### 8.3 Color Palette

| Color | Usage | Value |
|-------|-------|-------|
| Primary | Actions, progress indicators | `#3B82F6` (Blue) |
| Success | Completed sets, progression earned | `#10B981` (Green) |
| Warning | Partial completion | `#F59E0B` (Amber) |
| Muted | Skipped, inactive | `#6B7280` (Gray) |
| Background | Main background | `#111827` (Dark) |
| Surface | Cards, inputs | `#1F2937` (Dark Gray) |
| Text Primary | Main text | `#F9FAFB` (White) |
| Text Secondary | Labels, hints | `#9CA3AF` (Light Gray) |

### 8.4 Key Screens Wireframes

#### 8.4.1 Home Screen (No Active Workout)

```
┌─────────────────────────────────────────┐
│ Hoppa                │
├─────────────────────────────────────────┤
│                                         │
│  Ready to lift?                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📋 Chest Focused Upper         │    │
│  │     Day 1 of PPL Schema         │    │
│  │     Last: 3 days ago            │    │
│  │                                 │    │
│  │     [  START WORKOUT  ]         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📋 Back Focused Upper          │    │
│  │     Day 2 of PPL Schema         │    │
│  │     Last: 5 days ago            │    │
│  │                                 │    │
│  │     [  START WORKOUT  ]         │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│  [Home]      [Schemas]      [History]   │
└─────────────────────────────────────────┘
```

#### 8.4.2 Active Workout Screen

```
┌─────────────────────────────────────────┐
│ ← Chest Focused Upper           ⏱ 23:45│
├─────────────────────────────────────────┤
│                                         │
│  Exercise 1 of 9                        │
│  ━━━━━━━━━░░░░░░░░░░░░░░░░░░░░ 11%     │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Incline Chest Press            │    │
│  │  ───────────────────────────    │    │
│  │                                 │    │
│  │  Target: 59.8kg                 │    │
│  │                                 │    │
│  │  [PLATE VISUAL: 20+2.5+1.25]    │    │
│  │  + 1kg microplate               │    │
│  │                                 │    │
│  │  Set 1 (5-7)    [    ]          │    │
│  │  Set 2 (5-7)    [    ]          │    │
│  │                                 │    │
│  │  [ SKIP ]        [ FINISH ]     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Chest Press Machine      NEXT │    │
│  │  78.6kg • 2 sets • 5-7 reps    │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│          [ END WORKOUT ]                │
└─────────────────────────────────────────┘
```

---

## 9. Premium Features (Convex Backend)

### 9.1 Overview

Premium users get access to cloud sync and advanced analytics. The app uses a hybrid storage approach: SQLite for offline-first local storage, with Convex providing real-time cloud sync for premium users.

### 9.2 Free vs Premium Comparison

| Feature | Free | Premium |
|---------|------|---------|
| Local workout logging | ✅ | ✅ |
| Plate calculator | ✅ | ✅ |
| Progressive loading tracking | ✅ | ✅ |
| AI schema import | ✅ (limited) | ✅ (unlimited) |
| Workout history | Last 30 days | Unlimited |
| Cloud backup & sync | ❌ | ✅ |
| Multi-device access | ❌ | ✅ |
| Progress dashboard | ❌ | ✅ |
| Exercise analytics | ❌ | ✅ |
| Data export | ❌ | ✅ |

### 9.3 Authentication

**Provider:** Convex Auth with social login support

**Supported Methods:**
- Email + Password
- Google OAuth
- Apple Sign-In (required for iOS App Store)

**Flow:**
1. User taps "Upgrade to Premium" or "Sign In"
2. Auth modal presents login options
3. On successful auth, local SQLite data syncs to Convex
4. Subsequent sessions sync bidirectionally

### 9.4 Data Sync Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Device                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   Zustand   │◄──►│   SQLite    │◄──►│   Sync Engine   │  │
│  │   (State)   │    │  (Local DB) │    │  (Premium only) │  │
│  └─────────────┘    └─────────────┘    └────────┬────────┘  │
└─────────────────────────────────────────────────┼───────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     Convex Backend                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │    Auth     │    │  Database   │    │    Functions    │  │
│  │   Service   │    │  (Tables)   │    │ (Queries/Mut.)  │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Sync Strategy:**
- **Initial sync:** Upload all local data to Convex on first premium login
- **Ongoing sync:** Real-time sync via Convex subscriptions
- **Conflict resolution:** Last-write-wins with timestamp comparison
- **Offline support:** Queue mutations locally, sync when online

### 9.5 Convex Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    isPremium: v.boolean(),
    premiumExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  schemas: defineTable({
    userId: v.id("users"),
    name: v.string(),
    progressiveLoadingEnabled: v.boolean(),  // Master toggle for schema
    createdAt: v.number(),
    updatedAt: v.number(),
    localId: v.optional(v.string()), // For sync with SQLite
  }).index("by_user", ["userId"]),

  workoutDays: defineTable({
    schemaId: v.id("schemas"),
    name: v.string(),
    orderIndex: v.number(),
    localId: v.optional(v.string()),
  }).index("by_schema", ["schemaId"]),

  exercises: defineTable({
    dayId: v.id("workoutDays"),
    name: v.string(),
    equipmentType: v.union(
      v.literal("plates"),
      v.literal("machine"),
      v.literal("other")
    ),
    baseWeight: v.number(),
    targetSets: v.number(),
    targetRepsMin: v.number(),
    targetRepsMax: v.number(),
    progressiveLoadingEnabled: v.boolean(),  // Per-exercise toggle
    progressionIncrement: v.number(),
    currentWeight: v.number(),
    orderIndex: v.number(),
    localId: v.optional(v.string()),
  }).index("by_day", ["dayId"]),

  workoutSessions: defineTable({
    userId: v.id("users"),
    schemaId: v.id("schemas"),
    dayId: v.id("workoutDays"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    localId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_schema", ["schemaId"])
    .index("by_user_and_date", ["userId", "startedAt"]),

  exerciseLogs: defineTable({
    sessionId: v.id("workoutSessions"),
    exerciseId: v.id("exercises"),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("skipped")
    ),
    microplateUsed: v.number(),
    totalWeight: v.number(),
    progressionEarned: v.boolean(),
    localId: v.optional(v.string()),
  }).index("by_session", ["sessionId"]),

  setLogs: defineTable({
    exerciseLogId: v.id("exerciseLogs"),
    setNumber: v.number(),
    targetReps: v.string(),
    completedReps: v.optional(v.number()),
  }).index("by_exercise_log", ["exerciseLogId"]),
});
```

### 9.6 Progress Dashboard

The dashboard provides visual insights into training progress over time.

#### 9.6.1 Dashboard Components

**1. Overview Cards**
```
┌─────────────────────────────────────────────────────────────┐
│                    Progress Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ 🏋️ 47      │  │ 📈 12       │  │ 💪 2,450kg          │  │
│  │ Workouts    │  │ Progressions│  │ Total Volume (week) │  │
│  │ This Month  │  │ This Month  │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**2. Exercise Progress Chart**
```
┌─────────────────────────────────────────────────────────────┐
│  Incline Chest Press                          ▼ Last 3 mo   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  70kg ┤                                           ●         │
│       │                                       ●───┘         │
│  65kg ┤                               ●───●───┘             │
│       │                           ●───┘                     │
│  60kg ┤               ●───●───●───┘                         │
│       │           ●───┘                                     │
│  55kg ┤   ●───●───┘                                         │
│       │───┘                                                 │
│  50kg ┼───────┬───────┬───────┬───────┬───────┬───────┬──   │
│       Nov    Dec     Jan     Feb     Mar     Apr            │
│                                                             │
│  Started: 50kg → Current: 70kg (+40%)                       │
│  Progressions: 8 | Avg time between: 12 days                │
└─────────────────────────────────────────────────────────────┘
```

**3. Exercise Selector**
```
┌─────────────────────────────────────────────────────────────┐
│  Select Exercise                                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🔍 Search exercises...                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  CHEST FOCUSED UPPER                                        │
│  ├── Incline Chest Press          70kg    📈 +20kg         │
│  ├── Chest Press Machine          85kg    📈 +15kg         │
│  ├── Chest Fly Machine            95kg    📈 +12.5kg       │
│  └── ...                                                    │
│                                                             │
│  BACK FOCUSED UPPER                                         │
│  ├── Lat Pulldown                 75kg    📈 +17.5kg       │
│  └── ...                                                    │
└─────────────────────────────────────────────────────────────┘
```

**4. Workout Calendar**
```
┌─────────────────────────────────────────────────────────────┐
│  January 2025                               ◀    ▶          │
├─────────────────────────────────────────────────────────────┤
│  Mo   Tu   We   Th   Fr   Sa   Su                          │
│            1    2    3    4    5                            │
│       ──   ●    ──   ●    ──   ──                          │
│  6    7    8    9    10   11   12                          │
│  ●    ──   ●    ──   ●    ──   ──                          │
│  13   14   15   16   17   18   19                          │
│  ●    ──   ●    ──   ◐    ──   ──                          │
│                       ▲                                     │
│                    Today                                    │
│                                                             │
│  ● Completed  ◐ In Progress  ── Rest Day                   │
└─────────────────────────────────────────────────────────────┘
```

#### 9.6.2 Dashboard Queries (Convex)

```typescript
// convex/progress.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

// Get exercise progress over time
export const getExerciseProgress = query({
  args: {
    exerciseId: v.id("exercises"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("exerciseLogs")
      .withIndex("by_exercise")
      .filter((q) => q.eq(q.field("exerciseId"), args.exerciseId))
      .collect();

    // Join with sessions to get dates
    const progressData = await Promise.all(
      logs.map(async (log) => {
        const session = await ctx.db.get(log.sessionId);
        return {
          date: session?.startedAt,
          weight: log.totalWeight,
          progressionEarned: log.progressionEarned,
        };
      })
    );

    return progressData
      .filter((d) => d.date && d.date >= args.startDate && d.date <= args.endDate)
      .sort((a, b) => a.date! - b.date!);
  },
});

// Get monthly statistics
export const getMonthlyStats = query({
  args: { userId: v.id("users"), month: v.number(), year: v.number() },
  handler: async (ctx, args) => {
    const startOfMonth = new Date(args.year, args.month - 1, 1).getTime();
    const endOfMonth = new Date(args.year, args.month, 0, 23, 59, 59).getTime();

    const sessions = await ctx.db
      .query("workoutSessions")
      .withIndex("by_user_and_date")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.gte(q.field("startedAt"), startOfMonth),
          q.lte(q.field("startedAt"), endOfMonth)
        )
      )
      .collect();

    const completedSessions = sessions.filter((s) => s.status === "completed");

    // Count progressions
    let totalProgressions = 0;
    let totalVolume = 0;

    for (const session of completedSessions) {
      const logs = await ctx.db
        .query("exerciseLogs")
        .withIndex("by_session")
        .filter((q) => q.eq(q.field("sessionId"), session._id))
        .collect();

      for (const log of logs) {
        if (log.progressionEarned) totalProgressions++;
        
        const sets = await ctx.db
          .query("setLogs")
          .withIndex("by_exercise_log")
          .filter((q) => q.eq(q.field("exerciseLogId"), log._id))
          .collect();

        totalVolume += sets.reduce(
          (sum, set) => sum + (set.completedReps || 0) * log.totalWeight,
          0
        );
      }
    }

    return {
      workoutCount: completedSessions.length,
      progressionCount: totalProgressions,
      totalVolume: Math.round(totalVolume),
    };
  },
});

// Get all exercises with their progress summary
export const getExerciseSummaries = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const schemas = await ctx.db
      .query("schemas")
      .withIndex("by_user")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    const summaries = [];

    for (const schema of schemas) {
      const days = await ctx.db
        .query("workoutDays")
        .withIndex("by_schema")
        .filter((q) => q.eq(q.field("schemaId"), schema._id))
        .collect();

      for (const day of days) {
        const exercises = await ctx.db
          .query("exercises")
          .withIndex("by_day")
          .filter((q) => q.eq(q.field("dayId"), day._id))
          .collect();

        for (const exercise of exercises) {
          // Get first and current weight for progress calculation
          const logs = await ctx.db
            .query("exerciseLogs")
            .filter((q) => q.eq(q.field("exerciseId"), exercise._id))
            .collect();

          const sortedLogs = logs.sort((a, b) => {
            // Would need to join with sessions for proper sorting
            return 0;
          });

          const firstWeight = sortedLogs[0]?.totalWeight || exercise.currentWeight;
          const gainedWeight = exercise.currentWeight - firstWeight;

          summaries.push({
            exerciseId: exercise._id,
            name: exercise.name,
            dayName: day.name,
            schemaName: schema.name,
            currentWeight: exercise.currentWeight,
            gainedWeight,
            progressionCount: logs.filter((l) => l.progressionEarned).length,
          });
        }
      }
    }

    return summaries;
  },
});
```

### 9.7 Premium Subscription

**Pricing Model:** Monthly or Annual subscription

| Plan | Price | Billing |
|------|-------|---------|
| Monthly | €4.99/month | Recurring |
| Annual | €39.99/year | Recurring (save 33%) |

**Payment Integration:** RevenueCat (handles both App Store and Google Play)

**Premium Activation Flow:**
1. User taps "Go Premium" button
2. RevenueCat paywall is presented
3. User completes purchase via App Store / Google Play
4. On success, user is prompted to create account or sign in
5. `isPremium` flag set in Convex, data sync begins

---

## 10. Personal Trainer Platform (Phase 3)

### 10.1 Overview

The Personal Trainer (PT) Platform extends Hoppa into a B2B SaaS product. Personal trainers get a web-based dashboard to manage clients, create and distribute workout schemas, track client progress, and handle payments—all integrated with the existing mobile app.

### 10.2 Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Personal Trainer (Web)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐   │
│  │   Client    │  │   Schema    │  │  Progress   │  │   Payments    │   │
│  │ Management  │  │   Builder   │  │  Dashboard  │  │   (Stripe)    │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘   │
└─────────┼────────────────┼────────────────┼─────────────────┼───────────┘
          │                │                │                 │
          ▼                ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Convex Backend                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐   │
│  │   Trainers  │  │   Clients   │  │  Schemas    │  │ Subscriptions │   │
│  │   Table     │  │   Table     │  │  + Assigns  │  │    Table      │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │                │                │                 │
          ▼                ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Client Mobile App                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  • Receives schemas from PT via push notification               │    │
│  │  • Workouts sync to PT dashboard in real-time                   │    │
│  │  • Client sees PT branding (optional white-label)               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Tech Stack Additions

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Web Framework | Next.js 14 (App Router) | React-based, excellent DX, same mental model as RN |
| Styling (Web) | Tailwind CSS | Consistent with NativeWind in mobile app |
| Charts | Recharts | Lightweight, React-native, good for dashboards |
| Payments | Stripe | Industry standard, handles subscriptions + payouts |
| Email | Resend | Modern email API, great developer experience |
| Push Notifications | Expo Push | Already in stack, works for schema delivery |

### 10.4 Personal Trainer Features

#### 10.4.1 Client Management

**Capabilities:**
- Add clients via email invitation
- Client accepts invite → links their app account to trainer
- View all clients in a list with status indicators
- Archive/remove clients (maintains history)

**Client States:**
| State | Description |
|-------|-------------|
| Invited | Email sent, awaiting acceptance |
| Active | Linked account, currently training |
| Paused | Temporarily inactive (e.g., vacation, injury) |
| Archived | No longer a client, read-only history |

**Client Card View:**
```
┌─────────────────────────────────────────────────────────────┐
│  Client Management                        + Add Client      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  👤 Jan de Vries                        ● Active    │    │
│  │  ─────────────────────────────────────────────────  │    │
│  │  Last workout: Today, 09:15                         │    │
│  │  Current schema: PPL Strength Phase 2               │    │
│  │  This week: 3/4 sessions completed                  │    │
│  │                                                     │    │
│  │  [View Progress]  [Edit Schema]  [Message]          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  👤 Lisa Bakker                         ● Active    │    │
│  │  ─────────────────────────────────────────────────  │    │
│  │  Last workout: 2 days ago                           │    │
│  │  Current schema: Upper/Lower Hypertrophy            │    │
│  │  This week: 2/4 sessions completed                  │    │
│  │                                                     │    │
│  │  [View Progress]  [Edit Schema]  [Message]          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 10.4.2 Schema Builder (Web)

Enhanced schema builder optimized for trainer workflows:

**Features:**
- Drag-and-drop exercise ordering
- Exercise library with search and filters
- Copy/duplicate schemas between clients
- Template library (save schemas as reusable templates)
- Notes per exercise (form cues, alternatives)
- Assign schema to one or multiple clients

**Schema Builder UI:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Schema Builder                                          [Save Draft]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Schema Name: [PPL Strength - Beginner Phase 1        ]                 │
│                                                                         │
│  ┌─────────────────────────────────┐  ┌───────────────────────────────┐ │
│  │  DAYS                           │  │  DAY 1: Push                  │ │
│  │  ─────────────────────────────  │  │  ───────────────────────────  │ │
│  │  [+ Add Day]                    │  │                               │ │
│  │                                 │  │  ≡ Bench Press                │ │
│  │  📋 Day 1: Push         ← ●    │  │    Plates | 3 sets | 5-7 reps │ │
│  │  📋 Day 2: Pull                 │  │    Base: 20kg | +2.5kg prog   │ │
│  │  📋 Day 3: Legs                 │  │    Note: Pause at bottom      │ │
│  │                                 │  │                               │ │
│  │                                 │  │  ≡ Incline DB Press           │ │
│  │                                 │  │    Other | 3 sets | 8-10 reps │ │
│  │                                 │  │    +2.5kg prog                │ │
│  │                                 │  │                               │ │
│  │                                 │  │  [+ Add Exercise]             │ │
│  └─────────────────────────────────┘  └───────────────────────────────┘ │
│                                                                         │
│  Assign to: [Select clients...                              ▼]         │
│             ☑ Jan de Vries  ☑ Lisa Bakker  ☐ Mark Jansen               │
│                                                                         │
│  ┌────────────────────┐  ┌────────────────────────────────────────┐     │
│  │   Save as Template │  │   Send to Clients (2 selected)        │     │
│  └────────────────────┘  └────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 10.4.3 Client Progress Dashboard

Trainers can view detailed progress for each client:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Clients          Jan de Vries                    ● Active   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Overview        Exercises        Workouts        Notes                 │
│  ━━━━━━━━        ─────────        ────────        ─────                 │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ 📈 47       │  │ 🏋️ 156     │  │ 💪 12       │  │ 📊 89%          │ │
│  │ Workouts    │  │ Total Vol.  │  │ Progressions│  │ Adherence       │ │
│  │ (3 months)  │  │ (tons)      │  │ This Month  │  │ Rate            │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                                                                         │
│  Strength Progress (Last 3 Months)                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │  100kg ┤                              Bench ────                │    │
│  │        │                           ●───●───●    Squat - - -     │    │
│  │   80kg ┤               ●───●───●───┘           Deadlift ····    │    │
│  │        │       ●───●───┘   - - ● - - ●                          │    │
│  │   60kg ┤   ●───┘   - - - - ┘           ·····●·····●·····●       │    │
│  │        │   - - - - -               ·····                        │    │
│  │   40kg ┼───────┬───────┬───────┬───────┬───────┬───────┬──      │    │
│  │        Oct    Nov     Dec     Jan     Feb     Mar               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  Recent Activity                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Today 09:15    Push Day - Completed                            │    │
│  │                 ✓ Bench 82.5kg (7,7,6) - Progression earned!    │    │
│  │                 ✓ Incline DB 26kg (10,9,8)                      │    │
│  │                 ✗ Tricep Pushdown - Skipped (equipment busy)    │    │
│  │                                                                 │    │
│  │  Yesterday      Rest Day                                        │    │
│  │                                                                 │    │
│  │  2 days ago     Pull Day - Completed                            │    │
│  │                 ✓ All exercises completed                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 10.4.4 Payments & Billing (Stripe Integration)

**Trainer Payment Collection:**
Personal trainers can optionally collect payments from clients through the platform.

**Features:**
- Connect Stripe account (Stripe Connect)
- Set pricing per client (monthly/per-session)
- Automatic invoicing
- Payment reminders
- Revenue dashboard

**Payment Flow:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Client    │     │   Platform   │     │   Trainer    │
│    (Pays)    │────►│   (Stripe)   │────►│  (Receives)  │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     Platform takes
                     5-10% fee on
                     transactions
```

**Billing Dashboard:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Billing & Payments                              [Connect Stripe]  ✓    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  This Month                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ 💰 €1,240       │  │ 📊 €1,178       │  │ 👥 8/10 clients paid    │  │
│  │ Gross Revenue   │  │ Net (after 5%)  │  │                         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                         │
│  Client Billing                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Client          │ Plan           │ Amount  │ Status  │ Action  │    │
│  │  ────────────────┼────────────────┼─────────┼─────────┼──────── │    │
│  │  Jan de Vries    │ Monthly        │ €150    │ ✓ Paid  │ [View]  │    │
│  │  Lisa Bakker     │ Monthly        │ €150    │ ✓ Paid  │ [View]  │    │
│  │  Mark Jansen     │ 10-session     │ €400    │ 3 left  │ [View]  │    │
│  │  Anna Smit       │ Monthly        │ €120    │ ⚠ Due   │ [Remind]│    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.5 Convex Schema Additions

```typescript
// convex/schema.ts - Additional tables for PT platform

// Personal Trainers
trainers: defineTable({
  userId: v.id("users"),              // Links to existing users table
  businessName: v.optional(v.string()),
  stripeAccountId: v.optional(v.string()),
  stripeOnboarded: v.boolean(),
  subscriptionTier: v.union(
    v.literal("starter"),
    v.literal("professional"),
    v.literal("business")
  ),
  subscriptionStatus: v.union(
    v.literal("active"),
    v.literal("past_due"),
    v.literal("canceled")
  ),
  maxClients: v.number(),
  createdAt: v.number(),
}).index("by_user", ["userId"]),

// Trainer-Client relationships
trainerClients: defineTable({
  trainerId: v.id("trainers"),
  clientId: v.optional(v.id("users")),  // Null until client accepts
  clientEmail: v.string(),
  status: v.union(
    v.literal("invited"),
    v.literal("active"),
    v.literal("paused"),
    v.literal("archived")
  ),
  inviteToken: v.optional(v.string()),
  invitedAt: v.number(),
  acceptedAt: v.optional(v.number()),
  billingType: v.optional(v.union(
    v.literal("monthly"),
    v.literal("per_session"),
    v.literal("package"),
    v.literal("external")           // Billed outside platform
  )),
  billingAmount: v.optional(v.number()),
  notes: v.optional(v.string()),
})
  .index("by_trainer", ["trainerId"])
  .index("by_client", ["clientId"])
  .index("by_invite_token", ["inviteToken"]),

// Schema assignments (trainer assigns schema to client)
schemaAssignments: defineTable({
  schemaId: v.id("schemas"),
  trainerId: v.id("trainers"),
  clientId: v.id("users"),
  assignedAt: v.number(),
  startDate: v.optional(v.number()),
  endDate: v.optional(v.number()),
  status: v.union(
    v.literal("active"),
    v.literal("completed"),
    v.literal("replaced")
  ),
})
  .index("by_client", ["clientId"])
  .index("by_trainer", ["trainerId"]),

// Schema templates (trainer's reusable schemas)
schemaTemplates: defineTable({
  trainerId: v.id("trainers"),
  name: v.string(),
  description: v.optional(v.string()),
  category: v.optional(v.string()),    // e.g., "Strength", "Hypertrophy"
  schemaData: v.any(),                 // Full schema structure as JSON
  createdAt: v.number(),
  updatedAt: v.number(),
  usageCount: v.number(),              // How many times assigned
}).index("by_trainer", ["trainerId"]),

// Client payments
clientPayments: defineTable({
  trainerClientId: v.id("trainerClients"),
  stripePaymentIntentId: v.string(),
  amount: v.number(),
  currency: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("succeeded"),
    v.literal("failed"),
    v.literal("refunded")
  ),
  description: v.optional(v.string()),
  createdAt: v.number(),
  paidAt: v.optional(v.number()),
}).index("by_trainer_client", ["trainerClientId"]),
```

### 10.6 Pricing Model for Personal Trainers

#### 10.6.1 Subscription Tiers (Per-Client Pricing)

The pricing model scales with the trainer's business, using per-client pricing within tiers.

| Tier | Clients | Price | Per Client |
|------|---------|-------|------------|
| **Starter** | 1-3 | Free forever | €0 |
| **Pro** | 4-30 | From €19/month | €3-4/client |
| **Studio** | 31-100+ | From €79/month | ~€2/client |

#### 10.6.2 Pro Tier Pricing Scale

| Clients | Price/Month | Per Client |
|---------|-------------|------------|
| 5 | €19 | €3.80 |
| 10 | €35 | €3.50 |
| 15 | €49 | €3.27 |
| 20 | €59 | €2.95 |
| 30 | €79 | €2.63 |

#### 10.6.3 Studio Tier Pricing Scale

| Clients | Price/Month | Per Client |
|---------|-------------|------------|
| 35 | €79 | €2.26 |
| 50 | €99 | €1.98 |
| 75 | €139 | €1.85 |
| 100 | €179 | €1.79 |
| 100+ | €179 + €1.50/client | €1.50+ |

#### 10.6.4 Feature Comparison

| Feature | Starter (Free) | Pro | Studio |
|---------|----------------|-----|--------|
| **Max Clients** | 3 | 30 | 100+ |
| **Schema Builder** | ✓ | ✓ | ✓ |
| **Client Progress Dashboard** | Basic | Advanced | Advanced |
| **Schema Templates** | 3 | Unlimited | Unlimited |
| **Payment Collection** | ❌ | ✓ (3% fee) | ✓ (2% fee) |
| **Export Reports (PDF)** | ❌ | ✓ | ✓ |
| **Team Members** | ❌ | ❌ | ✓ (up to 5) |
| **Priority Support** | ❌ | ✓ | ✓ |
| **Custom Branding** | ❌ | Logo | Full |
| **API Access** | ❌ | ❌ | ✓ |

#### 10.6.5 Payment Processing Fees

When trainers collect payments through the platform:

| Tier | Platform Fee | Stripe Fee | Total |
|------|--------------|------------|-------|
| Pro | 3% | ~2.9% + €0.25 | ~6% |
| Studio | 2% | ~2.9% + €0.25 | ~5% |

**Example:** Client pays €150/month
- Pro tier: Trainer receives €141 (€150 - 3% - Stripe fees)
- Studio tier: Trainer receives €142.50 (€150 - 2% - Stripe fees)

#### 10.6.6 Revenue Projections

**Assumptions:**
- Target: 500 paying trainers in Year 1
- Distribution: 50% small (avg 8 clients), 35% medium (avg 18 clients), 15% large (avg 50 clients)

**Monthly Recurring Revenue (MRR):**
| Segment | Trainers | Avg Clients | Avg Price | MRR |
|---------|----------|-------------|-----------|-----|
| Small (Pro) | 250 | 8 | €29 | €7,250 |
| Medium (Pro) | 175 | 18 | €55 | €9,625 |
| Large (Studio) | 75 | 50 | €99 | €7,425 |
| **Subscription Total** | | | | **€24,300** |

**Transaction Revenue (Monthly):**
| Tier | Trainers | Avg Volume | Fee | Revenue |
|------|----------|------------|-----|---------|
| Pro | 425 | €1,200 | 3% | €15,300 |
| Studio | 75 | €3,000 | 2% | €4,500 |
| **Transaction Total** | | | | **€19,800** |

**Total Projected MRR:** €44,100/month

### 10.7 Client App Changes

#### 10.7.1 Linked Account Experience

When a client is linked to a trainer:

```
┌─────────────────────────────────────────┐
│ Hoppa                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  👤 Your Trainer                │    │
│  │  FitCoach Amsterdam             │    │
│  │                                 │    │
│  │  New schema available!          │    │
│  │  "PPL Strength Phase 2"         │    │
│  │                                 │    │
│  │  [View Schema]  [Message]       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Ready to lift?                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📋 Push Day                    │    │
│  │     PPL Strength Phase 2        │    │
│  │     Assigned by FitCoach        │    │
│  │                                 │    │
│  │     [  START WORKOUT  ]         │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

#### 10.7.2 Schema Received Notification

```
┌─────────────────────────────────────────┐
│                                         │
│            📋                           │
│                                         │
│     New Schema from FitCoach            │
│                                         │
│     "PPL Strength Phase 2"              │
│     3 days • 27 exercises               │
│                                         │
│     Your trainer added notes:           │
│     "Great progress! Time to increase   │
│      volume. Focus on form for the      │
│      new exercises."                    │
│                                         │
│     ┌─────────────────────────────┐     │
│     │      Start Using Schema     │     │
│     └─────────────────────────────┘     │
│                                         │
│     [View Details]   [Ask Question]     │
│                                         │
└─────────────────────────────────────────┘
```

### 10.8 User Stories (PT Platform)

| ID | User Story | Priority |
|----|------------|----------|
| PT-001 | As a PT, I want to invite clients via email so they can link their app to my dashboard | Must Have |
| PT-002 | As a PT, I want to create workout schemas in a web builder so I can efficiently program for clients | Must Have |
| PT-003 | As a PT, I want to send schemas directly to client apps so they can start training immediately | Must Have |
| PT-004 | As a PT, I want to view client workout history and progress so I can adjust programming | Must Have |
| PT-005 | As a PT, I want to save schemas as templates so I can reuse them for similar clients | Should Have |
| PT-006 | As a PT, I want to collect payments through the platform so I don't need separate invoicing | Should Have |
| PT-007 | As a PT, I want to see which clients completed workouts this week so I can follow up with inactive ones | Should Have |
| PT-008 | As a PT, I want to add notes to exercises so clients know proper form cues | Should Have |
| PT-009 | As a client, I want to receive schemas from my PT in the app so I don't have to enter them manually | Must Have |
| PT-010 | As a client, I want to message my PT through the app so I can ask questions | Nice to Have |

### 10.9 Timeline Estimate (PT Platform)

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Web App Setup | 1 week | Next.js project, auth, basic layout |
| Trainer Onboarding | 1 week | Registration, subscription (Stripe) |
| Client Management | 1.5 weeks | Invite flow, client list, status management |
| Schema Builder (Web) | 2 weeks | Drag-drop builder, templates, assignment |
| Client Sync | 1 week | Push notifications, schema delivery to app |
| Progress Dashboard | 2 weeks | Client analytics, charts, activity feed |
| Payment Collection | 2 weeks | Stripe Connect, invoicing, payouts |
| Testing & Polish | 1.5 weeks | Edge cases, mobile testing, documentation |
| **Total PT Platform** | **12 weeks** | Full PT Platform Ready |

**Cumulative Timeline:**
| Phase | Duration | Cumulative |
|-------|----------|------------|
| MVP (Free) | 7.5 weeks | 7.5 weeks |
| Premium (Sync + Dashboard) | 7 weeks | 14.5 weeks |
| PT Platform | 12 weeks | 26.5 weeks |

---

## 11. API Specifications

### 9.1 AI Schema Import (Claude API)

**Endpoint:** Anthropic Claude API (claude-3-sonnet or claude-3-haiku)

**Request:**
```typescript
interface AISchemaRequest {
  image: string;  // Base64 encoded image
  prompt: string;
}
```

**Response Handling:**
```typescript
interface AISchemaResponse {
  days: {
    name: string;
    exercises: {
      name: string;
      sets: number;
      repsMin: number;
      repsMax: number;
      notes?: string;
    }[];
  }[];
}
```

**Error States:**
- Image unclear: Prompt user to retake photo
- Partial extraction: Show extracted data with warnings for missing fields
- API error: Fallback to manual entry with error message

---

## 10. Local Storage Schema (SQLite)

```sql
-- Schemas
CREATE TABLE schemas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  progressive_loading_enabled INTEGER NOT NULL DEFAULT 1,  -- 1 = true, 0 = false
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Workout Days
CREATE TABLE workout_days (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

-- Exercises
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  day_id TEXT NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL CHECK (equipment_type IN ('plates', 'machine', 'other')),
  base_weight REAL NOT NULL DEFAULT 0,
  target_sets INTEGER NOT NULL,
  target_reps_min INTEGER NOT NULL,
  target_reps_max INTEGER NOT NULL,
  progressive_loading_enabled INTEGER NOT NULL DEFAULT 1,  -- 1 = true, 0 = false
  progression_increment REAL NOT NULL DEFAULT 2.5,
  current_weight REAL NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL
);

-- Workout Sessions
CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES schemas(id),
  day_id TEXT NOT NULL REFERENCES workout_days(id),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed'))
);

-- Exercise Logs
CREATE TABLE exercise_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'skipped')),
  microplate_used REAL NOT NULL DEFAULT 0,
  total_weight REAL NOT NULL,
  progression_earned INTEGER NOT NULL DEFAULT 0
);

-- Set Logs
CREATE TABLE set_logs (
  id TEXT PRIMARY KEY,
  exercise_log_id TEXT NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  target_reps TEXT NOT NULL,
  completed_reps INTEGER
);

-- Indexes for common queries
CREATE INDEX idx_workout_days_schema ON workout_days(schema_id);
CREATE INDEX idx_exercises_day ON exercises(day_id);
CREATE INDEX idx_sessions_schema ON workout_sessions(schema_id);
CREATE INDEX idx_exercise_logs_session ON exercise_logs(session_id);
CREATE INDEX idx_set_logs_exercise_log ON set_logs(exercise_log_id);
```

---

## 11. State Management (Zustand)

### 11.1 Workout Store

```typescript
interface WorkoutState {
  // Current session
  activeSession: WorkoutSession | null;
  currentExerciseIndex: number;
  
  // Actions
  startWorkout: (schemaId: string, dayId: string) => Promise<void>;
  logReps: (exerciseLogId: string, setNumber: number, reps: number) => void;
  finishExercise: (exerciseLogId: string) => void;
  skipExercise: (exerciseLogId: string) => void;
  completeWorkout: () => Promise<void>;
  
  // Computed
  getCurrentExercise: () => ExerciseLog | null;
  getProgress: () => { completed: number; total: number };
}
```

### 11.2 Schema Store

```typescript
interface SchemaState {
  schemas: Schema[];
  isLoading: boolean;
  
  // Actions
  loadSchemas: () => Promise<void>;
  createSchema: (schema: Omit<Schema, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateSchema: (id: string, updates: Partial<Schema>) => Promise<void>;
  deleteSchema: (id: string) => Promise<void>;
  importFromAI: (imageBase64: string) => Promise<Partial<Schema>>;
}
```

---

## 13. Scope Definition

### 13.1 MVP Scope (Phase 1 - Free Tier)

**In Scope:**
- Manual schema creation with full exercise configuration
- AI-powered schema import from screenshots (limited to 3/month)
- Active workout logging with rep tracking
- Plate calculator with visual breakdown
- Microplate support (track separately, display in UI)
- Automatic progression tracking and weight updates
- Basic workout history (last 30 days)
- Offline-first with local SQLite storage
- Dark theme optimized for gym use

**Out of Scope for MVP:**
- Cloud sync and backup
- Progress dashboard
- Multi-device access
- Data export
- Unlimited AI imports

### 13.2 Premium Scope (Phase 2 - v1.1)

**In Scope:**
- User authentication (Email, Google, Apple)
- Cloud backup and sync via Convex
- Multi-device access with real-time sync
- Unlimited workout history
- Progress dashboard with charts
- Exercise analytics and statistics
- Workout calendar view
- Data export (JSON/CSV)
- Unlimited AI schema imports

**Out of Scope for Premium v1.1:**
- Personal trainer features
- Custom microplate progression schema
- Exercise library with pre-populated exercises
- Rest timer between sets

### 13.3 Personal Trainer Platform Scope (Phase 3 - v2.0)

**In Scope:**
- PT web dashboard (Next.js)
- Trainer registration and subscription management
- Client invitation and management system
- Web-based schema builder with drag-and-drop
- Schema templates library
- Send schemas to client apps (push notifications)
- Client progress dashboard for trainers
- Payment collection via Stripe Connect
- Trainer subscription tiers (Starter/Professional/Business)

**Out of Scope for PT Platform v2.0:**
- White-label mobile app (Business tier - future)
- In-app messaging/chat
- Video exercise library
- Group training features
- Workout templates marketplace
- Apple Watch / Wear OS companion app

---

## 14. Success Metrics

### 14.1 MVP Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Schema Creation Time | <5 minutes | Time from app open to first workout start |
| Workout Logging Speed | <10 seconds per set | Time between set completion and next set start |
| Progression Accuracy | 100% | Correct weight suggestions after hitting targets |
| App Crashes | <1% of sessions | Crash-free session rate |
| Daily Active Usage | 3+ sessions/week | For regular gym-goers |

### 14.2 Premium Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Free to Premium Conversion | 5% | Within 30 days of install |
| Premium Retention | 80% | Monthly renewal rate |
| Dashboard Engagement | 2x/week | Dashboard views per premium user |
| Sync Success Rate | 99.9% | Successful data syncs |
| Churn Rate | <10%/month | Premium cancellations |

### 14.3 PT Platform Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Trainer Sign-ups | 500 in Year 1 | New trainer registrations |
| Trainer Retention | 85% | Monthly subscription renewal |
| Avg Clients per Trainer | 12 | Active clients per paying trainer |
| Schema Send Success | 99% | Schemas successfully delivered to clients |
| Payment Adoption | 40% | Trainers using payment collection |
| MRR (Subscriptions) | €18,000 | Monthly recurring revenue from trainer subs |
| MRR (Transactions) | €23,000 | Monthly revenue from payment fees |
| Client Activation | 80% | Invited clients who complete first workout |

---

## 15. Timeline Estimate

### 15.1 MVP Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Setup & Foundation | 1 week | Project setup, navigation, basic UI components |
| Schema Management | 1.5 weeks | Manual creation, storage, editing |
| AI Import | 1 week | Claude API integration, image processing |
| Workout Execution | 2 weeks | Active workout UI, rep logging, plate calculator |
| Progression Engine | 1 week | Progression logic, weight updates |
| Polish & Testing | 1 week | Bug fixes, performance, edge cases |
| **Total MVP** | **7.5 weeks** | MVP Ready |

### 15.2 Premium Timeline (Phase 2)

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Convex Setup | 0.5 weeks | Schema, basic queries/mutations |
| Authentication | 1 week | Convex Auth, login flows, account management |
| Sync Engine | 1.5 weeks | SQLite ↔ Convex bidirectional sync |
| Progress Dashboard | 2 weeks | Charts, statistics, calendar view |
| RevenueCat Integration | 1 week | Paywall, subscription handling |
| Testing & Polish | 1 week | Edge cases, offline scenarios |
| **Total Premium** | **7 weeks** | Premium Features Ready |

### 15.3 PT Platform Timeline (Phase 3)

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Web App Setup | 1 week | Next.js project, auth, basic layout |
| Trainer Onboarding | 1 week | Registration, subscription (Stripe) |
| Client Management | 1.5 weeks | Invite flow, client list, status management |
| Schema Builder (Web) | 2 weeks | Drag-drop builder, templates, assignment |
| Client Sync | 1 week | Push notifications, schema delivery to app |
| Progress Dashboard | 2 weeks | Client analytics, charts, activity feed |
| Payment Collection | 2 weeks | Stripe Connect, invoicing, payouts |
| Testing & Polish | 1.5 weeks | Edge cases, mobile testing, documentation |
| **Total PT Platform** | **12 weeks** | Full PT Platform Ready |

### 15.4 Cumulative Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| MVP (Free Tier) | 7.5 weeks | 7.5 weeks |
| Premium (Sync + Dashboard) | 7 weeks | 14.5 weeks |
| PT Platform (B2B) | 12 weeks | **26.5 weeks** |

**Total time to full product: ~6.5 months**

---

## 15. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI schema extraction accuracy | Medium | Medium | Provide manual editing after AI extraction; iterate on prompts |
| Plate calculation edge cases | High | Low | Comprehensive unit tests; manual override option |
| Offline data loss | High | Low | SQLite with WAL mode; periodic backup reminders |
| Complex UI during workout | Medium | Medium | User testing with actual gym sessions; large touch targets |
| API costs for AI import | Low | Low | Use Claude Haiku for cost efficiency; rate limiting |

---

## 16. Open Questions

1. Should users be able to have multiple active schemas (e.g., PPL and a separate arm day)?
2. What happens if a user wants to change weight mid-workout (not just at progression)?
3. Should the app suggest deload weeks after consecutive failed progressions?
4. How should the app handle exercises that don't fit the plates available (e.g., 23.75kg per side)?
5. Should there be a "warm-up set" feature that doesn't count toward progression?

---

## Appendix A: Plate Visualization Reference

### Standard Gym Plates (per side)
- 20kg (Red)
- 10kg (Green)  
- 5kg (White)
- 2.5kg (Red, small)
- 1.25kg (Green, small)

### User Microplates (per side, distinct styling)
- 1kg
- 0.75kg
- 0.5kg
- 0.25kg

### Example Calculation

**Target:** 59.8kg on Incline Chest Press  
**Base (Bar):** 11.3kg  
**Weight to load:** 59.8 - 11.3 = 48.5kg total = 24.25kg per side

**Per Side Breakdown (from bar outward):**
- 1x 20kg plate (closest to bar)
- 1x 2.5kg plate
- 1x 1.25kg plate (outermost)
- **Total per side:** 23.75kg
- **Microplate needed:** 0.5kg (brings total to 24.25kg per side)

**Visual representation:**
```
  ┌────┬───┬────┐         ┌────┬───┬────┐
  │1.25│2.5│ 20 │═════════│ 20 │2.5│1.25│
  └────┴───┴────┘   BAR   └────┴───┴────┘
        ◄─────────────────────────►
         Heaviest plates at center
```

**Final:** 11.3kg + (24.25kg × 2) = 59.8kg ✓

---

## Appendix B: Progression Rules Reference

### Standard Progressive Loading
- Upper body exercises: +2.5kg when all sets hit target reps
- Lower body exercises: +5kg when all sets hit target reps

### Target Achievement
For an exercise with target "2 sets × 5-7 reps":
- **Progression earned:** Both sets complete with **7 reps each** (maximum of range)
- **No progression:** Any set below 7 reps, or exercise skipped

### Example Scenarios

| Set 1 | Set 2 | Result |
|-------|-------|--------|
| 7 reps | 7 reps | ✅ Progression (+2.5kg) |
| 7 reps | 6 reps | ❌ No progression |
| 6 reps | 6 reps | ❌ No progression |
| 8 reps | 7 reps | ✅ Progression (+2.5kg) |
| 7 reps | - (skipped) | ❌ No progression |