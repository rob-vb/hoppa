import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all exercise logs for a session
export const listBySession = query({
  args: { sessionId: v.id("workoutSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exerciseLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// Get exercise log with its set logs
export const getWithSets = query({
  args: { id: v.id("exerciseLogs") },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.id);
    if (!log) return null;

    const setLogs = await ctx.db
      .query("setLogs")
      .withIndex("by_exercise_log", (q) => q.eq("exerciseLogId", args.id))
      .collect();

    setLogs.sort((a, b) => a.setNumber - b.setNumber);

    return { ...log, setLogs };
  },
});

// Get recent logs for a specific exercise (for history/progress tracking)
export const listByExercise = query({
  args: {
    exerciseId: v.id("exercises"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("exerciseLogs")
      .withIndex("by_exercise", (q) => q.eq("exerciseId", args.exerciseId))
      .order("desc");

    if (args.limit) {
      return await query.take(args.limit);
    }
    return await query.collect();
  },
});

// Update exercise log status
export const updateStatus = mutation({
  args: {
    id: v.id("exerciseLogs"),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("skipped")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Update exercise log with weight adjustments
export const updateWeight = mutation({
  args: {
    id: v.id("exerciseLogs"),
    microplateUsed: v.number(),
    totalWeight: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      microplateUsed: args.microplateUsed,
      totalWeight: args.totalWeight,
    });
  },
});

// Mark progression earned
export const markProgressionEarned = mutation({
  args: {
    id: v.id("exerciseLogs"),
    progressionEarned: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { progressionEarned: args.progressionEarned });
  },
});

// Complete an exercise (update status and optionally apply progression)
export const complete = mutation({
  args: {
    id: v.id("exerciseLogs"),
    progressionEarned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.id);
    if (!log) throw new Error("Exercise log not found");

    await ctx.db.patch(args.id, {
      status: "completed",
      progressionEarned: args.progressionEarned,
    });

    // If progression was earned, update the exercise's current weight
    if (args.progressionEarned) {
      const exercise = await ctx.db.get(log.exerciseId);
      if (exercise && exercise.progressiveLoadingEnabled) {
        const newWeight = exercise.currentWeight + exercise.progressionIncrement;
        await ctx.db.patch(exercise._id, { currentWeight: newWeight });
      }
    }
  },
});

// Skip an exercise
export const skip = mutation({
  args: { id: v.id("exerciseLogs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "skipped" });
  },
});

// Create an exercise log directly (for sync - doesn't auto-create set logs)
export const createDirect = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const exerciseLogId = await ctx.db.insert("exerciseLogs", {
      sessionId: args.sessionId,
      exerciseId: args.exerciseId,
      status: args.status,
      microplateUsed: args.microplateUsed,
      totalWeight: args.totalWeight,
      progressionEarned: args.progressionEarned,
    });

    return exerciseLogId;
  },
});
