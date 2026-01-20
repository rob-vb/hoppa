import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table for authentication
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    externalId: v.string(), // Auth provider's user ID
  })
    .index("by_external_id", ["externalId"])
    .index("by_email", ["email"]),

  // Schema - workout template
  schemas: defineTable({
    userId: v.id("users"),
    name: v.string(),
    progressiveLoadingEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  // Workout Day - a day within a schema
  workoutDays: defineTable({
    schemaId: v.id("schemas"),
    name: v.string(),
    orderIndex: v.number(),
  }).index("by_schema", ["schemaId"]),

  // Exercise - an exercise within a workout day
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
    progressiveLoadingEnabled: v.boolean(),
    progressionIncrement: v.number(),
    currentWeight: v.number(),
    orderIndex: v.number(),
  }).index("by_day", ["dayId"]),

  // Workout Session - a single workout instance
  workoutSessions: defineTable({
    userId: v.id("users"),
    schemaId: v.id("schemas"),
    dayId: v.id("workoutDays"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_completed", ["userId", "completedAt"])
    .index("by_day", ["dayId"])
    .index("by_day_status", ["dayId", "status"]),

  // Exercise Log - log of an exercise within a session
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
  })
    .index("by_session", ["sessionId"])
    .index("by_exercise", ["exerciseId"]),

  // Set Log - log of a single set within an exercise
  setLogs: defineTable({
    exerciseLogId: v.id("exerciseLogs"),
    setNumber: v.number(),
    targetReps: v.string(),
    completedReps: v.optional(v.number()),
  }).index("by_exercise_log", ["exerciseLogId"]),
});
