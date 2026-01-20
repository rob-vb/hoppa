import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all set logs for an exercise log
export const listByExerciseLog = query({
  args: { exerciseLogId: v.id("exerciseLogs") },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("setLogs")
      .withIndex("by_exercise_log", (q) =>
        q.eq("exerciseLogId", args.exerciseLogId)
      )
      .collect();

    return logs.sort((a, b) => a.setNumber - b.setNumber);
  },
});

// Get a single set log
export const get = query({
  args: { id: v.id("setLogs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Log reps for a set
export const logReps = mutation({
  args: {
    id: v.id("setLogs"),
    completedReps: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { completedReps: args.completedReps });
  },
});

// Clear reps for a set (undo)
export const clearReps = mutation({
  args: { id: v.id("setLogs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { completedReps: undefined });
  },
});

// Batch log reps for multiple sets
export const batchLogReps = mutation({
  args: {
    sets: v.array(
      v.object({
        id: v.id("setLogs"),
        completedReps: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const set of args.sets) {
      await ctx.db.patch(set.id, { completedReps: set.completedReps });
    }
  },
});
