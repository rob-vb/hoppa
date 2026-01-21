import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get subscription status for current user
export const getSubscriptionStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return {
      isPremium: user.isPremium ?? false,
      subscriptionPlan: user.subscriptionPlan ?? "free",
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
    };
  },
});

// Update subscription status after purchase verification
export const updateSubscription = mutation({
  args: {
    isPremium: v.boolean(),
    subscriptionPlan: v.union(
      v.literal("free"),
      v.literal("monthly"),
      v.literal("annual")
    ),
    subscriptionExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(userId, {
      isPremium: args.isPremium,
      subscriptionPlan: args.subscriptionPlan,
      subscriptionExpiresAt: args.subscriptionExpiresAt,
    });
  },
});

// Clear subscription (on expiration or cancellation)
export const clearSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    await ctx.db.patch(userId, {
      isPremium: false,
      subscriptionPlan: "free",
      subscriptionExpiresAt: undefined,
    });
  },
});
