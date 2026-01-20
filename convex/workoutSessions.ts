import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all sessions for a user
export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workoutSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get completed sessions for a user (history)
export const listCompleted = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workoutSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "completed")
      )
      .order("desc")
      .collect();
  },
});

// Get in-progress session for a user (if any)
export const getInProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workoutSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "in_progress")
      )
      .first();
  },
});

// Get a single session by ID
export const get = query({
  args: { id: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get session with all exercise logs and set logs
export const getWithLogs = query({
  args: { id: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return null;

    const exerciseLogs = await ctx.db
      .query("exerciseLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    // Get set logs for each exercise log
    const exerciseLogsWithSets = await Promise.all(
      exerciseLogs.map(async (log) => {
        const setLogs = await ctx.db
          .query("setLogs")
          .withIndex("by_exercise_log", (q) => q.eq("exerciseLogId", log._id))
          .collect();

        setLogs.sort((a, b) => a.setNumber - b.setNumber);

        return { ...log, setLogs };
      })
    );

    return { ...session, exerciseLogs: exerciseLogsWithSets };
  },
});

// Get recent sessions for a specific day (for history)
export const listByDay = query({
  args: {
    dayId: v.id("workoutDays"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("workoutSessions")
      .withIndex("by_day_status", (q) =>
        q.eq("dayId", args.dayId).eq("status", "completed")
      )
      .order("desc");

    if (args.limit) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});

// Start a new workout session
export const start = mutation({
  args: {
    userId: v.id("users"),
    schemaId: v.id("schemas"),
    dayId: v.id("workoutDays"),
    localId: v.string(),
    exerciseLogLocalIds: v.array(v.string()),
    setLogLocalIds: v.array(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Check for existing in-progress session
    const existing = await ctx.db
      .query("workoutSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "in_progress")
      )
      .first();

    if (existing) {
      throw new Error("Already have an in-progress workout session");
    }

    const now = Date.now();

    // Create the session
    const sessionId = await ctx.db.insert("workoutSessions", {
      userId: args.userId,
      schemaId: args.schemaId,
      dayId: args.dayId,
      localId: args.localId,
      startedAt: now,
      status: "in_progress",
    });

    // Get exercises for this day
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_day", (q) => q.eq("dayId", args.dayId))
      .collect();

    // Sort exercises by orderIndex to match the order of localIds
    exercises.sort((a, b) => a.orderIndex - b.orderIndex);

    // Create exercise logs and set logs for each exercise
    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];
      const exerciseLogLocalId = args.exerciseLogLocalIds[i];
      const setLogLocalIds = args.setLogLocalIds[i] || [];

      const exerciseLogId = await ctx.db.insert("exerciseLogs", {
        sessionId,
        exerciseId: exercise._id,
        localId: exerciseLogLocalId,
        status: "pending",
        microplateUsed: 0,
        totalWeight: exercise.currentWeight,
        progressionEarned: false,
        updatedAt: now,
      });

      // Create set logs
      for (let j = 0; j < exercise.targetSets; j++) {
        const setLogLocalId = setLogLocalIds[j];
        await ctx.db.insert("setLogs", {
          exerciseLogId,
          localId: setLogLocalId,
          setNumber: j + 1,
          targetReps: `${exercise.targetRepsMin}-${exercise.targetRepsMax}`,
          updatedAt: now,
        });
      }
    }

    return sessionId;
  },
});

// Complete a workout session
export const complete = mutation({
  args: { id: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found");
    if (session.status === "completed") {
      throw new Error("Session already completed");
    }

    await ctx.db.patch(args.id, {
      status: "completed",
      completedAt: Date.now(),
    });
  },
});

// Abandon/delete a workout session
export const abandon = mutation({
  args: { id: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found");

    // Delete all set logs and exercise logs
    const exerciseLogs = await ctx.db
      .query("exerciseLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();

    for (const log of exerciseLogs) {
      const setLogs = await ctx.db
        .query("setLogs")
        .withIndex("by_exercise_log", (q) => q.eq("exerciseLogId", log._id))
        .collect();

      for (const setLog of setLogs) {
        await ctx.db.delete(setLog._id);
      }

      await ctx.db.delete(log._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Create a workout session directly (for sync - doesn't auto-create logs)
export const createDirect = mutation({
  args: {
    userId: v.id("users"),
    schemaId: v.id("schemas"),
    dayId: v.id("workoutDays"),
    localId: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("workoutSessions", {
      userId: args.userId,
      schemaId: args.schemaId,
      dayId: args.dayId,
      localId: args.localId,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
      status: args.status,
    });

    return sessionId;
  },
});
