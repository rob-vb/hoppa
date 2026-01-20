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

    // Create the session
    const sessionId = await ctx.db.insert("workoutSessions", {
      userId: args.userId,
      schemaId: args.schemaId,
      dayId: args.dayId,
      startedAt: Date.now(),
      status: "in_progress",
    });

    // Get exercises for this day
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_day", (q) => q.eq("dayId", args.dayId))
      .collect();

    // Create exercise logs and set logs for each exercise
    for (const exercise of exercises) {
      const exerciseLogId = await ctx.db.insert("exerciseLogs", {
        sessionId,
        exerciseId: exercise._id,
        status: "pending",
        microplateUsed: 0,
        totalWeight: exercise.currentWeight,
        progressionEarned: false,
      });

      // Create set logs
      for (let i = 1; i <= exercise.targetSets; i++) {
        await ctx.db.insert("setLogs", {
          exerciseLogId,
          setNumber: i,
          targetReps: `${exercise.targetRepsMin}-${exercise.targetRepsMax}`,
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
