import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all schemas for a user
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schemas")
      .withIndex("by_user_updated", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get a single schema by ID
export const get = query({
  args: { id: v.id("schemas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get schema with all its days and exercises
export const getWithDays = query({
  args: { id: v.id("schemas") },
  handler: async (ctx, args) => {
    const schema = await ctx.db.get(args.id);
    if (!schema) return null;

    const days = await ctx.db
      .query("workoutDays")
      .withIndex("by_schema", (q) => q.eq("schemaId", args.id))
      .collect();

    // Sort by orderIndex
    days.sort((a, b) => a.orderIndex - b.orderIndex);

    // Get exercises for each day
    const daysWithExercises = await Promise.all(
      days.map(async (day) => {
        const exercises = await ctx.db
          .query("exercises")
          .withIndex("by_day", (q) => q.eq("dayId", day._id))
          .collect();

        exercises.sort((a, b) => a.orderIndex - b.orderIndex);

        return { ...day, exercises };
      })
    );

    return { ...schema, days: daysWithExercises };
  },
});

// Create a new schema
export const create = mutation({
  args: {
    userId: v.id("users"),
    localId: v.string(),
    name: v.string(),
    progressiveLoadingEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("schemas", {
      userId: args.userId,
      localId: args.localId,
      name: args.name,
      progressiveLoadingEnabled: args.progressiveLoadingEnabled,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update a schema
export const update = mutation({
  args: {
    id: v.id("schemas"),
    name: v.optional(v.string()),
    progressiveLoadingEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Delete a schema and all related data
export const remove = mutation({
  args: { id: v.id("schemas") },
  handler: async (ctx, args) => {
    // Get all days for this schema
    const days = await ctx.db
      .query("workoutDays")
      .withIndex("by_schema", (q) => q.eq("schemaId", args.id))
      .collect();

    // Delete exercises for each day
    for (const day of days) {
      const exercises = await ctx.db
        .query("exercises")
        .withIndex("by_day", (q) => q.eq("dayId", day._id))
        .collect();

      for (const exercise of exercises) {
        await ctx.db.delete(exercise._id);
      }

      await ctx.db.delete(day._id);
    }

    // Delete the schema
    await ctx.db.delete(args.id);
  },
});
