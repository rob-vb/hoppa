import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import Stripe from "stripe";
import { mapStripeStatus } from "./stripe";

const http = httpRouter();

auth.addHttpRoutes(http);

// Stripe webhook handler
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("No signature provided", { status: 400 });
    }

    const body = await request.text();

    let event: Stripe.Event;
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2025-01-27.acacia",
      });
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Webhook signature verification failed", {
        status: 400,
      });
    }

    // Handle subscription events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const trainerId = session.metadata?.trainerId;
          const tier = session.metadata?.tier as "pro" | "studio" | undefined;

          if (trainerId && tier) {
            await ctx.runMutation(
              internal.stripe.updateTrainerSubscriptionFromWebhook,
              {
                trainerId: trainerId as any,
                subscriptionTier: tier,
                subscriptionStatus: "active",
                stripeSubscriptionId:
                  typeof session.subscription === "string"
                    ? session.subscription
                    : session.subscription.id,
              }
            );
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const trainerId = subscription.metadata?.trainerId;
        const tier = subscription.metadata?.tier as "pro" | "studio" | undefined;

        if (trainerId) {
          const status = mapStripeStatus(subscription.status);
          await ctx.runMutation(
            internal.stripe.updateTrainerSubscriptionFromWebhook,
            {
              trainerId: trainerId as any,
              subscriptionTier: tier || "pro",
              subscriptionStatus: status,
              stripeSubscriptionId: subscription.id,
            }
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const trainerId = subscription.metadata?.trainerId;

        if (trainerId) {
          // Downgrade to starter tier
          await ctx.runMutation(
            internal.stripe.updateTrainerSubscriptionFromWebhook,
            {
              trainerId: trainerId as any,
              subscriptionTier: "starter",
              subscriptionStatus: "canceled",
              stripeSubscriptionId: undefined,
            }
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (
          invoice.subscription &&
          typeof invoice.subscription === "string"
        ) {
          // Get the subscription to find the trainer
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: "2025-01-27.acacia",
          });
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          );
          const trainerId = subscription.metadata?.trainerId;

          if (trainerId) {
            await ctx.runMutation(
              internal.stripe.updateTrainerSubscriptionFromWebhook,
              {
                trainerId: trainerId as any,
                subscriptionTier:
                  (subscription.metadata?.tier as "pro" | "studio") || "pro",
                subscriptionStatus: "past_due",
                stripeSubscriptionId: subscription.id,
              }
            );
          }
        }
        break;
      }

      default:
        // Unhandled event type
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
