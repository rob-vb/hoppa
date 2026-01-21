import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get the current user's trainer profile
export const currentTrainer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const trainer = await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return trainer;
  },
});

// Get trainer by ID
export const get = query({
  args: { id: v.id("trainers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get trainer by user ID
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Register as a trainer (creates trainer profile)
export const register = mutation({
  args: {
    businessName: v.optional(v.string()),
    bio: v.optional(v.string()),
    qualifications: v.optional(v.array(v.string())),
    specialties: v.optional(v.array(v.string())),
    selectedTier: v.optional(
      v.union(v.literal("starter"), v.literal("pro"), v.literal("studio"))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // Check if user already has a trainer profile
    const existingTrainer = await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingTrainer) {
      throw new Error("User is already registered as a trainer");
    }

    // Update user type to trainer
    await ctx.db.patch(userId, {
      userType: "trainer",
    });

    const now = Date.now();

    // Determine tier and max clients
    const tier = args.selectedTier || "starter";
    let maxClients = 3; // starter default
    if (tier === "pro") {
      maxClients = 30;
    } else if (tier === "studio") {
      maxClients = 100;
    }

    // Create trainer profile
    // Note: For paid tiers, actual subscription activation happens via Stripe checkout
    const trainerId = await ctx.db.insert("trainers", {
      userId,
      businessName: args.businessName,
      bio: args.bio,
      qualifications: args.qualifications,
      specialties: args.specialties,
      stripeOnboarded: false,
      subscriptionTier: tier,
      subscriptionStatus: tier === "starter" ? "active" : "trialing",
      maxClients,
      createdAt: now,
      updatedAt: now,
    });

    return { trainerId, requiresPayment: tier !== "starter", tier };
  },
});

// Update trainer profile
export const updateProfile = mutation({
  args: {
    businessName: v.optional(v.string()),
    bio: v.optional(v.string()),
    qualifications: v.optional(v.array(v.string())),
    specialties: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const trainer = await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!trainer) {
      throw new Error("Trainer profile not found");
    }

    await ctx.db.patch(trainer._id, {
      ...args,
      updatedAt: Date.now(),
    });

    return trainer._id;
  },
});

// Update subscription tier (called after Stripe webhook)
export const updateSubscription = mutation({
  args: {
    trainerId: v.id("trainers"),
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
  },
  handler: async (ctx, args) => {
    const trainer = await ctx.db.get(args.trainerId);
    if (!trainer) {
      throw new Error("Trainer not found");
    }

    // Determine max clients based on tier
    let maxClients = 3; // starter
    if (args.subscriptionTier === "pro") {
      maxClients = 30;
    } else if (args.subscriptionTier === "studio") {
      maxClients = 100;
    }

    await ctx.db.patch(args.trainerId, {
      subscriptionTier: args.subscriptionTier,
      subscriptionStatus: args.subscriptionStatus,
      maxClients,
      updatedAt: Date.now(),
    });
  },
});

// Connect Stripe account
export const connectStripe = mutation({
  args: {
    stripeAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const trainer = await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!trainer) {
      throw new Error("Trainer profile not found");
    }

    await ctx.db.patch(trainer._id, {
      stripeAccountId: args.stripeAccountId,
      stripeOnboarded: true,
      updatedAt: Date.now(),
    });
  },
});

// Get trainer's clients
export const getClients = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("invited"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("archived")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    const trainer = await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!trainer) {
      return [];
    }

    let clientsQuery = ctx.db
      .query("trainerClients")
      .withIndex("by_trainer", (q) => q.eq("trainerId", trainer._id));

    const clients = await clientsQuery.collect();

    // Filter by status if provided
    const filteredClients = args.status
      ? clients.filter((c) => c.status === args.status)
      : clients;

    // Fetch user details for clients who have accepted
    const clientsWithDetails = await Promise.all(
      filteredClients.map(async (client) => {
        let userDetails = null;
        if (client.clientId) {
          userDetails = await ctx.db.get(client.clientId);
        }
        return {
          ...client,
          user: userDetails,
        };
      })
    );

    return clientsWithDetails;
  },
});

// Get trainer's client count
export const getClientCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { total: 0, active: 0, maxClients: 0 };
    }

    const trainer = await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!trainer) {
      return { total: 0, active: 0, maxClients: 0 };
    }

    const clients = await ctx.db
      .query("trainerClients")
      .withIndex("by_trainer", (q) => q.eq("trainerId", trainer._id))
      .collect();

    const activeClients = clients.filter(
      (c) => c.status === "active" || c.status === "invited"
    );

    return {
      total: clients.length,
      active: activeClients.length,
      maxClients: trainer.maxClients,
    };
  },
});

// Check if user is a trainer
export const isTrainer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return false;
    }

    const user = await ctx.db.get(userId);
    return user?.userType === "trainer";
  },
});

// Get trainer's clients with workout activity stats
export const getClientsWithActivity = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("invited"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("archived")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    const trainer = await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!trainer) {
      return [];
    }

    const clients = await ctx.db
      .query("trainerClients")
      .withIndex("by_trainer", (q) => q.eq("trainerId", trainer._id))
      .collect();

    // Filter by status if provided
    const filteredClients = args.status
      ? clients.filter((c) => c.status === args.status)
      : clients;

    // Fetch user details and workout activity for each client
    const clientsWithActivity = await Promise.all(
      filteredClients.map(async (client) => {
        let userDetails = null;
        let lastWorkout: number | null = null;
        let totalWorkouts = 0;
        let workoutsThisWeek = 0;

        if (client.clientId) {
          userDetails = await ctx.db.get(client.clientId);

          // Get workout sessions for this client
          const sessions = await ctx.db
            .query("workoutSessions")
            .withIndex("by_user", (q) => q.eq("userId", client.clientId!))
            .collect();

          const completedSessions = sessions.filter(
            (s) => s.status === "completed" && s.completedAt
          );

          totalWorkouts = completedSessions.length;

          // Find most recent workout
          if (completedSessions.length > 0) {
            const sorted = completedSessions.sort(
              (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)
            );
            lastWorkout = sorted[0].completedAt ?? null;
          }

          // Count workouts this week
          const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          workoutsThisWeek = completedSessions.filter(
            (s) => s.completedAt && s.completedAt >= oneWeekAgo
          ).length;
        }

        return {
          ...client,
          user: userDetails,
          lastWorkout,
          totalWorkouts,
          workoutsThisWeek,
        };
      })
    );

    return clientsWithActivity;
  },
});
