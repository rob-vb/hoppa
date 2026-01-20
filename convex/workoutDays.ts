import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all days for a schema
export const listBySchema = query({
  args: { schemaId: v.id("schemas") },
  handler: async (ctx, args) => {
    const days = await ctx.db
      .query("workoutDays")
      .withIndex("by_schema", (q) => q.eq("schemaId", args.schemaId))
      .collect();

    return days.sort((a, b) => a.orderIndex - b.orderIndex);
  },
});

// Get a single day by ID
export const get = query({
  args: { id: v.id("workoutDays") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get a day with its exercises
export const getWithExercises = query({
  args: { id: v.id("workoutDays") },
  handler: async (ctx, args) => {
    const day = await ctx.db.get(args.id);
    if (!day) return null;

    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_day", (q) => q.eq("dayId", args.id))
      .collect();

    exercises.sort((a, b) => a.orderIndex - b.orderIndex);

    return { ...day, exercises };
  },
});

// Create a new workout day
export const create = mutation({
  args: {
    schemaId: v.id("schemas"),
    name: v.string(),
    orderIndex: v.number(),
  },
  handler: async (ctx, args) => {
    // Update schema's updatedAt
    await ctx.db.patch(args.schemaId, { updatedAt: Date.now() });

    return await ctx.db.insert("workoutDays", {
      schemaId: args.schemaId,
      name: args.name,
      orderIndex: args.orderIndex,
    });
  },
});

// Update a workout day
export const update = mutation({
  args: {
    id: v.id("workoutDays"),
    name: v.optional(v.string()),
    orderIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const day = await ctx.db.get(args.id);
    if (!day) throw new Error("Day not found");

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, filteredUpdates);

    // Update schema's updatedAt
    await ctx.db.patch(day.schemaId, { updatedAt: Date.now() });
  },
});

// Delete a workout day and its exercises
export const remove = mutation({
  args: { id: v.id("workoutDays") },
  handler: async (ctx, args) => {
    const day = await ctx.db.get(args.id);
    if (!day) throw new Error("Day not found");

    // Delete all exercises for this day
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_day", (q) => q.eq("dayId", args.id))
      .collect();

    for (const exercise of exercises) {
      await ctx.db.delete(exercise._id);
    }

    // Delete the day
    await ctx.db.delete(args.id);

    // Update schema's updatedAt
    await ctx.db.patch(day.schemaId, { updatedAt: Date.now() });
  },
});

// Reorder days within a schema
export const reorder = mutation({
  args: {
    schemaId: v.id("schemas"),
    dayIds: v.array(v.id("workoutDays")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.dayIds.length; i++) {
      await ctx.db.patch(args.dayIds[i], { orderIndex: i });
    }

    await ctx.db.patch(args.schemaId, { updatedAt: Date.now() });
  },
});
