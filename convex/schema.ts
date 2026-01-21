import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  // Users table for authentication - extended from authTables
  users: defineTable({
    // Required by Convex Auth
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // User type - client (default) or trainer
    userType: v.optional(
      v.union(v.literal("client"), v.literal("trainer"))
    ),
    // Subscription fields
    isPremium: v.optional(v.boolean()),
    subscriptionPlan: v.optional(
      v.union(v.literal("free"), v.literal("monthly"), v.literal("annual"))
    ),
    subscriptionExpiresAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("by_user_type", ["userType"]),

  // Personal Trainers - extended profile for trainers
  trainers: defineTable({
    userId: v.id("users"),
    businessName: v.optional(v.string()),
    bio: v.optional(v.string()),
    qualifications: v.optional(v.array(v.string())),
    specialties: v.optional(v.array(v.string())),
    // Stripe Connect integration (for receiving payments from clients)
    stripeAccountId: v.optional(v.string()),
    stripeOnboarded: v.boolean(),
    // Stripe subscription (for paying platform fees)
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    // Subscription tier for trainer platform
    subscriptionTier: v.union(
      v.literal("starter"),
      v.literal("pro"),
      v.literal("studio")
    ),
    subscriptionStatus: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("trialing")
    ),
    maxClients: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_subscription_status", ["subscriptionStatus"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  // Trainer-Client relationships
  trainerClients: defineTable({
    trainerId: v.id("trainers"),
    clientId: v.optional(v.id("users")), // Null until client accepts invite
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
    // Billing configuration
    billingType: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("per_session"),
        v.literal("package"),
        v.literal("external")
      )
    ),
    billingAmount: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_trainer", ["trainerId"])
    .index("by_client", ["clientId"])
    .index("by_invite_token", ["inviteToken"])
    .index("by_trainer_status", ["trainerId", "status"]),

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
    notes: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_trainer", ["trainerId"])
    .index("by_schema", ["schemaId"])
    .index("by_client_status", ["clientId", "status"]),

  // Schema templates (trainer's reusable schemas)
  schemaTemplates: defineTable({
    trainerId: v.id("trainers"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    schemaData: v.any(), // Full schema structure as JSON
    createdAt: v.number(),
    updatedAt: v.number(),
    usageCount: v.number(),
  })
    .index("by_trainer", ["trainerId"])
    .index("by_trainer_category", ["trainerId", "category"]),

  // Schema - workout template
  schemas: defineTable({
    userId: v.id("users"),
    localId: v.string(), // SQLite UUID for local ↔ Convex mapping
    name: v.string(),
    progressiveLoadingEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_local_id", ["localId"]),

  // Workout Day - a day within a schema
  workoutDays: defineTable({
    schemaId: v.id("schemas"),
    localId: v.string(), // SQLite UUID for local ↔ Convex mapping
    name: v.string(),
    orderIndex: v.number(),
    updatedAt: v.number(),
  })
    .index("by_schema", ["schemaId"])
    .index("by_schema_updated", ["schemaId", "updatedAt"])
    .index("by_local_id", ["localId"]),

  // Exercise - an exercise within a workout day
  exercises: defineTable({
    dayId: v.id("workoutDays"),
    localId: v.string(), // SQLite UUID for local ↔ Convex mapping
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
    progressiveLoadingEnabled: v.boolean(),
    progressionIncrement: v.number(),
    currentWeight: v.number(),
    orderIndex: v.number(),
    updatedAt: v.number(),
  })
    .index("by_day", ["dayId"])
    .index("by_day_updated", ["dayId", "updatedAt"])
    .index("by_local_id", ["localId"]),

  // Workout Session - a single workout instance
  workoutSessions: defineTable({
    userId: v.id("users"),
    schemaId: v.id("schemas"),
    dayId: v.id("workoutDays"),
    localId: v.string(), // SQLite UUID for local ↔ Convex mapping
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_completed", ["userId", "completedAt"])
    .index("by_day", ["dayId"])
    .index("by_day_status", ["dayId", "status"])
    .index("by_schema", ["schemaId"])
    .index("by_day_completed", ["dayId", "completedAt"])
    .index("by_local_id", ["localId"]),

  // Exercise Log - log of an exercise within a session
  exerciseLogs: defineTable({
    sessionId: v.id("workoutSessions"),
    exerciseId: v.id("exercises"),
    localId: v.string(), // SQLite UUID for local ↔ Convex mapping
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("skipped")
    ),
    microplateUsed: v.number(),
    totalWeight: v.number(),
    progressionEarned: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_exercise", ["exerciseId"])
    .index("by_session_status", ["sessionId", "status"])
    .index("by_session_updated", ["sessionId", "updatedAt"])
    .index("by_local_id", ["localId"]),

  // Set Log - log of a single set within an exercise
  setLogs: defineTable({
    exerciseLogId: v.id("exerciseLogs"),
    localId: v.string(), // SQLite UUID for local ↔ Convex mapping
    setNumber: v.number(),
    targetReps: v.string(),
    completedReps: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_exercise_log", ["exerciseLogId"])
    .index("by_exercise_log_updated", ["exerciseLogId", "updatedAt"])
    .index("by_local_id", ["localId"]),
});
