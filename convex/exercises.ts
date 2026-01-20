import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all exercises for a day
export const listByDay = query({
  args: { dayId: v.id("workoutDays") },
  handler: async (ctx, args) => {
    const exercises = await ctx.db
      .query("exercises")
      .withIndex("by_day", (q) => q.eq("dayId", args.dayId))
      .collect();

    return exercises.sort((a, b) => a.orderIndex - b.orderIndex);
  },
});

// Get a single exercise by ID
export const get = query({
  args: { id: v.id("exercises") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new exercise
export const create = mutation({
  args: {
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
    orderIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const day = await ctx.db.get(args.dayId);
    if (!day) throw new Error("Day not found");

    const now = Date.now();

    // Update schema's updatedAt and day's updatedAt
    await ctx.db.patch(day.schemaId, { updatedAt: now });
    await ctx.db.patch(args.dayId, { updatedAt: now });

    return await ctx.db.insert("exercises", {
      ...args,
      currentWeight: args.baseWeight,
      updatedAt: now,
    });
  },
});

// Update an exercise
export const update = mutation({
  args: {
    id: v.id("exercises"),
    name: v.optional(v.string()),
    equipmentType: v.optional(
      v.union(v.literal("plates"), v.literal("machine"), v.literal("other"))
    ),
    baseWeight: v.optional(v.number()),
    targetSets: v.optional(v.number()),
    targetRepsMin: v.optional(v.number()),
    targetRepsMax: v.optional(v.number()),
    progressiveLoadingEnabled: v.optional(v.boolean()),
    progressionIncrement: v.optional(v.number()),
    currentWeight: v.optional(v.number()),
    orderIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const exercise = await ctx.db.get(args.id);
    if (!exercise) throw new Error("Exercise not found");

    const day = await ctx.db.get(exercise.dayId);
    if (!day) throw new Error("Day not found");

    const now = Date.now();
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, { ...filteredUpdates, updatedAt: now });

    // Update day's and schema's updatedAt
    await ctx.db.patch(exercise.dayId, { updatedAt: now });
    await ctx.db.patch(day.schemaId, { updatedAt: now });
  },
});

// Delete an exercise
export const remove = mutation({
  args: { id: v.id("exercises") },
  handler: async (ctx, args) => {
    const exercise = await ctx.db.get(args.id);
    if (!exercise) throw new Error("Exercise not found");

    const day = await ctx.db.get(exercise.dayId);
    if (!day) throw new Error("Day not found");

    await ctx.db.delete(args.id);

    // Update schema's updatedAt
    await ctx.db.patch(day.schemaId, { updatedAt: Date.now() });
  },
});

// Reorder exercises within a day
export const reorder = mutation({
  args: {
    dayId: v.id("workoutDays"),
    exerciseIds: v.array(v.id("exercises")),
  },
  handler: async (ctx, args) => {
    const day = await ctx.db.get(args.dayId);
    if (!day) throw new Error("Day not found");

    const now = Date.now();

    for (let i = 0; i < args.exerciseIds.length; i++) {
      await ctx.db.patch(args.exerciseIds[i], { orderIndex: i, updatedAt: now });
    }

    await ctx.db.patch(args.dayId, { updatedAt: now });
    await ctx.db.patch(day.schemaId, { updatedAt: now });
  },
});

// Update exercise weight after progression
export const applyProgression = mutation({
  args: {
    id: v.id("exercises"),
    newWeight: v.number(),
  },
  handler: async (ctx, args) => {
    const exercise = await ctx.db.get(args.id);
    if (!exercise) throw new Error("Exercise not found");

    await ctx.db.patch(args.id, { currentWeight: args.newWeight, updatedAt: Date.now() });
  },
});
