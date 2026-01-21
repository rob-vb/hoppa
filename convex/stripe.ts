import Stripe from "stripe";
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Trainer subscription tiers configuration
export const TRAINER_TIERS = {
  starter: {
    name: "Starter",
    price: 0, // Free tier
    maxClients: 3,
    features: ["Up to 3 clients", "Basic schema templates", "Email support"],
  },
  pro: {
    name: "Pro",
    price: 2900, // €29/month in cents
    maxClients: 30,
    features: [
      "Up to 30 clients",
      "Advanced analytics",
      "Priority support",
      "Custom branding",
    ],
  },
  studio: {
    name: "Studio",
    price: 7900, // €79/month in cents
    maxClients: 100,
    features: [
      "Up to 100 clients",
      "Team management",
      "API access",
      "Dedicated support",
      "White-label options",
    ],
  },
} as const;

// Initialize Stripe client
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-01-27.acacia",
  });
}

// Get trainer by user ID (internal)
export const getTrainerByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Get trainer by Stripe customer ID (internal)
export const getTrainerByStripeCustomerId = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trainers")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .unique();
  },
});

// Update trainer Stripe customer ID (internal)
export const updateTrainerStripeCustomerId = internalMutation({
  args: {
    trainerId: v.id("trainers"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.trainerId, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });
  },
});

// Update trainer subscription from webhook (internal)
export const updateTrainerSubscriptionFromWebhook = internalMutation({
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
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let maxClients = 3;
    if (args.subscriptionTier === "pro") {
      maxClients = 30;
    } else if (args.subscriptionTier === "studio") {
      maxClients = 100;
    }

    await ctx.db.patch(args.trainerId, {
      subscriptionTier: args.subscriptionTier,
      subscriptionStatus: args.subscriptionStatus,
      stripeSubscriptionId: args.stripeSubscriptionId,
      maxClients,
      updatedAt: Date.now(),
    });
  },
});

// Create Stripe checkout session for trainer subscription
export const createCheckoutSession = action({
  args: {
    tier: v.union(v.literal("pro"), v.literal("studio")),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const trainer = await ctx.runQuery(internal.stripe.getTrainerByUserId, {
      userId,
    });
    if (!trainer) {
      throw new Error("Trainer profile not found");
    }

    const stripe = getStripeClient();
    const tierConfig = TRAINER_TIERS[args.tier];

    // Get or create Stripe customer
    let customerId = trainer.stripeCustomerId;
    if (!customerId) {
      const user = await ctx.runQuery(internal.users.getById, { userId });
      const customer = await stripe.customers.create({
        email: user?.email || undefined,
        name: user?.name || trainer.businessName || undefined,
        metadata: {
          trainerId: trainer._id,
          userId: userId,
        },
      });
      customerId = customer.id;

      await ctx.runMutation(internal.stripe.updateTrainerStripeCustomerId, {
        trainerId: trainer._id,
        stripeCustomerId: customerId,
      });
    }

    // Get or create price for the tier
    const priceId = await getOrCreatePrice(stripe, args.tier, tierConfig.price);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      subscription_data: {
        metadata: {
          trainerId: trainer._id,
          tier: args.tier,
        },
      },
      metadata: {
        trainerId: trainer._id,
        tier: args.tier,
      },
    });

    if (!session.url) {
      throw new Error("Failed to create checkout session");
    }

    return { url: session.url };
  },
});

// Create billing portal session for managing subscription
export const createBillingPortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const trainer = await ctx.runQuery(internal.stripe.getTrainerByUserId, {
      userId,
    });
    if (!trainer) {
      throw new Error("Trainer profile not found");
    }

    if (!trainer.stripeCustomerId) {
      throw new Error("No Stripe customer found. Please subscribe first.");
    }

    const stripe = getStripeClient();

    const session = await stripe.billingPortal.sessions.create({
      customer: trainer.stripeCustomerId,
      return_url: args.returnUrl,
    });

    return { url: session.url };
  },
});

// Get current subscription info
export const getSubscriptionInfo = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const trainer = await ctx.runQuery(internal.stripe.getTrainerByUserId, {
      userId,
    });
    if (!trainer) {
      return null;
    }

    if (!trainer.stripeSubscriptionId || !trainer.stripeCustomerId) {
      return {
        tier: trainer.subscriptionTier,
        status: trainer.subscriptionStatus,
        maxClients: trainer.maxClients,
        subscription: null,
      };
    }

    const stripe = getStripeClient();

    try {
      const subscription = await stripe.subscriptions.retrieve(
        trainer.stripeSubscriptionId
      );

      return {
        tier: trainer.subscriptionTier,
        status: trainer.subscriptionStatus,
        maxClients: trainer.maxClients,
        subscription: {
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          status: subscription.status,
        },
      };
    } catch {
      return {
        tier: trainer.subscriptionTier,
        status: trainer.subscriptionStatus,
        maxClients: trainer.maxClients,
        subscription: null,
      };
    }
  },
});

// Upgrade or downgrade an existing subscription
export const changeSubscription = action({
  args: {
    newTier: v.union(v.literal("pro"), v.literal("studio")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const trainer = await ctx.runQuery(internal.stripe.getTrainerByUserId, {
      userId,
    });
    if (!trainer) {
      throw new Error("Trainer profile not found");
    }

    if (!trainer.stripeSubscriptionId) {
      throw new Error("No active subscription to modify");
    }

    const stripe = getStripeClient();
    const newTierConfig = TRAINER_TIERS[args.newTier];

    // Get the new price
    const newPriceId = await getOrCreatePrice(
      stripe,
      args.newTier,
      newTierConfig.price
    );

    // Retrieve current subscription
    const subscription = await stripe.subscriptions.retrieve(
      trainer.stripeSubscriptionId
    );

    if (subscription.status === "canceled") {
      throw new Error("Cannot modify a canceled subscription");
    }

    // Get current subscription item
    const subscriptionItem = subscription.items.data[0];
    if (!subscriptionItem) {
      throw new Error("No subscription item found");
    }

    // Determine if this is an upgrade or downgrade
    const currentTier = trainer.subscriptionTier;
    const isUpgrade =
      (currentTier === "starter" && (args.newTier === "pro" || args.newTier === "studio")) ||
      (currentTier === "pro" && args.newTier === "studio");

    // Update the subscription
    await stripe.subscriptions.update(trainer.stripeSubscriptionId, {
      items: [
        {
          id: subscriptionItem.id,
          price: newPriceId,
        },
      ],
      // For upgrades, charge immediately with prorated amount
      // For downgrades, apply at end of billing period
      proration_behavior: isUpgrade ? "create_prorations" : "none",
      // Update metadata with new tier
      metadata: {
        trainerId: trainer._id,
        tier: args.newTier,
      },
    });

    // For immediate updates (upgrades), update our database right away
    // For downgrades, the webhook will handle it when the billing period ends
    if (isUpgrade) {
      await ctx.runMutation(internal.stripe.updateTrainerSubscriptionFromWebhook, {
        trainerId: trainer._id,
        subscriptionTier: args.newTier,
        subscriptionStatus: "active",
        stripeSubscriptionId: trainer.stripeSubscriptionId,
      });
    }

    return {
      success: true,
      message: isUpgrade
        ? `Upgraded to ${newTierConfig.name}. You will be charged a prorated amount.`
        : `Downgraded to ${newTierConfig.name}. Changes will take effect at the end of your billing period.`,
    };
  },
});

// Downgrade to starter (cancel subscription)
export const downgradeToStarter = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; endDate: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const trainer = await ctx.runQuery(internal.stripe.getTrainerByUserId, {
      userId,
    });
    if (!trainer) {
      throw new Error("Trainer profile not found");
    }

    if (!trainer.stripeSubscriptionId) {
      throw new Error("No active subscription to cancel");
    }

    const stripe = getStripeClient();

    // Cancel at period end (graceful downgrade)
    const subscription = await stripe.subscriptions.update(
      trainer.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    return {
      success: true,
      endDate: subscription.current_period_end,
    };
  },
});

// Resume a subscription that was set to cancel
export const resumeSubscription = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const trainer = await ctx.runQuery(internal.stripe.getTrainerByUserId, {
      userId,
    });
    if (!trainer) {
      throw new Error("Trainer profile not found");
    }

    if (!trainer.stripeSubscriptionId) {
      throw new Error("No subscription to resume");
    }

    const stripe = getStripeClient();

    // Remove the cancel_at_period_end flag
    await stripe.subscriptions.update(trainer.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    return { success: true };
  },
});

// Helper function to get or create a Stripe price for a tier
async function getOrCreatePrice(
  stripe: Stripe,
  tier: "pro" | "studio",
  amount: number
): Promise<string> {
  const productName = `Hoppa Trainer ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
  const lookupKey = `hoppa_trainer_${tier}_monthly`;

  // Try to find existing price
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  // Create product if it doesn't exist
  const products = await stripe.products.list({
    active: true,
  });

  let product = products.data.find((p) => p.name === productName);

  if (!product) {
    product = await stripe.products.create({
      name: productName,
      description: `Hoppa Trainer Platform - ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`,
      metadata: {
        tier,
      },
    });
  }

  // Create price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: "eur",
    recurring: {
      interval: "month",
    },
    lookup_key: lookupKey,
  });

  return price.id;
}

// Helper to map Stripe subscription status to our status
export function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): "active" | "past_due" | "canceled" | "trialing" {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "trialing":
      return "trialing";
    default:
      return "active";
  }
}
