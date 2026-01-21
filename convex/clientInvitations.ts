import { Resend } from "resend";
import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Initialize Resend client
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey);
}

// Generate a cryptographically secure random invite token
function generateInviteToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(randomValues[i] % chars.length);
  }
  return token;
}

// Internal query to get trainer by user ID
export const getTrainerByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Internal query to get user by email
export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
  },
});

// Internal mutation to create invitation record
export const createInvitationRecord = internalMutation({
  args: {
    trainerId: v.id("trainers"),
    clientEmail: v.string(),
    inviteToken: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("trainerClients", {
      trainerId: args.trainerId,
      clientEmail: args.clientEmail,
      status: "invited",
      inviteToken: args.inviteToken,
      invitedAt: now,
      notes: args.notes,
    });
  },
});

// Internal mutation to update invitation token (for resend)
export const updateInvitationToken = internalMutation({
  args: {
    invitationId: v.id("trainerClients"),
    inviteToken: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invitationId, {
      inviteToken: args.inviteToken,
      invitedAt: Date.now(),
    });
  },
});

// Get invitation by token (internal)
export const getInvitationByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trainerClients")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .unique();
  },
});

// Accept invitation (internal mutation)
export const acceptInvitationMutation = internalMutation({
  args: {
    invitationId: v.id("trainerClients"),
    clientId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invitationId, {
      clientId: args.clientId,
      status: "active",
      acceptedAt: Date.now(),
      inviteToken: undefined, // Clear the token after use
    });
  },
});

// Send invitation email action
export const sendInvitation = action({
  args: {
    clientEmail: v.string(),
    clientName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; invitationId?: string; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Get trainer profile
    const trainer = await ctx.runQuery(
      internal.clientInvitations.getTrainerByUserId,
      { userId }
    );
    if (!trainer) {
      return { success: false, error: "Trainer profile not found" };
    }

    // Check client limit
    const activeClients = await ctx.runQuery(
      internal.clientInvitations.getActiveClientCount,
      { trainerId: trainer._id }
    );
    if (activeClients >= trainer.maxClients) {
      return {
        success: false,
        error: `Client limit reached (${trainer.maxClients}). Upgrade your plan to add more clients.`,
      };
    }

    // Check if client already invited or active
    const existingInvitation = await ctx.runQuery(
      internal.clientInvitations.getExistingInvitation,
      { trainerId: trainer._id, clientEmail: args.clientEmail }
    );
    if (existingInvitation) {
      if (existingInvitation.status === "active") {
        return { success: false, error: "This client is already active" };
      }
      if (existingInvitation.status === "invited") {
        return {
          success: false,
          error: "An invitation has already been sent to this email",
        };
      }
    }

    // Get trainer's user info for the email
    const trainerUser = await ctx.runQuery(internal.users.getById, { userId });

    // Generate invite token
    const inviteToken = generateInviteToken();

    // Create invitation record
    const invitationId = await ctx.runMutation(
      internal.clientInvitations.createInvitationRecord,
      {
        trainerId: trainer._id,
        clientEmail: args.clientEmail,
        inviteToken,
        notes: args.notes,
      }
    );

    // Send email
    try {
      const resend = getResendClient();
      const appUrl = process.env.APP_URL || "https://hoppa.app";
      const inviteLink = `${appUrl}/invite/${inviteToken}`;
      const trainerName =
        trainerUser?.name || trainer.businessName || "Your trainer";

      await resend.emails.send({
        from: "Hoppa <noreply@hoppa.app>",
        to: args.clientEmail,
        subject: `${trainerName} has invited you to train with Hoppa`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Hoppa</h1>
              </div>
              <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
                <h2 style="color: #1f2937; margin-top: 0;">You've been invited!</h2>
                <p style="color: #4b5563;">
                  ${args.clientName ? `Hi ${args.clientName},` : "Hi there,"}
                </p>
                <p style="color: #4b5563;">
                  <strong>${trainerName}</strong> has invited you to join them on Hoppa, the smart workout tracking app.
                </p>
                ${
                  args.notes
                    ? `<p style="color: #4b5563; background: #f3f4f6; padding: 16px; border-radius: 8px; font-style: italic;">"${args.notes}"</p>`
                    : ""
                }
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Accept Invitation
                  </a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">
                  This invitation link will expire in 7 days. If you didn't expect this email, you can safely ignore it.
                </p>
              </div>
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p>© ${new Date().getFullYear()} Hoppa. All rights reserved.</p>
              </div>
            </body>
          </html>
        `,
      });

      return { success: true, invitationId: invitationId };
    } catch (error) {
      console.error("Failed to send invitation email:", error);
      // Still return success since the invitation record was created
      // The trainer can resend the email if needed
      return {
        success: true,
        invitationId: invitationId,
        error: "Invitation created but email failed to send. You can resend it.",
      };
    }
  },
});

// Resend invitation email
export const resendInvitation = action({
  args: {
    invitationId: v.id("trainerClients"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Get trainer profile
    const trainer = await ctx.runQuery(
      internal.clientInvitations.getTrainerByUserId,
      { userId }
    );
    if (!trainer) {
      return { success: false, error: "Trainer profile not found" };
    }

    // Get the invitation
    const invitation = await ctx.runQuery(
      internal.clientInvitations.getInvitationById,
      { invitationId: args.invitationId }
    );
    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    // Verify ownership
    if (invitation.trainerId !== trainer._id) {
      return { success: false, error: "Not authorized" };
    }

    // Check if invitation is still pending
    if (invitation.status !== "invited") {
      return { success: false, error: "Invitation is no longer pending" };
    }

    // Generate new token
    const newToken = generateInviteToken();
    await ctx.runMutation(internal.clientInvitations.updateInvitationToken, {
      invitationId: args.invitationId,
      inviteToken: newToken,
    });

    // Get trainer's user info
    const trainerUser = await ctx.runQuery(internal.users.getById, { userId });

    // Send email
    try {
      const resend = getResendClient();
      const appUrl = process.env.APP_URL || "https://hoppa.app";
      const inviteLink = `${appUrl}/invite/${newToken}`;
      const trainerName =
        trainerUser?.name || trainer.businessName || "Your trainer";

      await resend.emails.send({
        from: "Hoppa <noreply@hoppa.app>",
        to: invitation.clientEmail,
        subject: `Reminder: ${trainerName} has invited you to train with Hoppa`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Hoppa</h1>
              </div>
              <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
                <h2 style="color: #1f2937; margin-top: 0;">Reminder: You've been invited!</h2>
                <p style="color: #4b5563;">
                  <strong>${trainerName}</strong> is waiting for you to join them on Hoppa.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Accept Invitation
                  </a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">
                  This invitation link will expire in 7 days.
                </p>
              </div>
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p>© ${new Date().getFullYear()} Hoppa. All rights reserved.</p>
              </div>
            </body>
          </html>
        `,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to resend invitation email:", error);
      return { success: false, error: "Failed to send email" };
    }
  },
});

// Cancel/delete invitation
export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("trainerClients"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const trainer = await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!trainer) {
      throw new Error("Trainer profile not found");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Verify ownership
    if (invitation.trainerId !== trainer._id) {
      throw new Error("Not authorized");
    }

    // Only allow canceling pending invitations
    if (invitation.status !== "invited") {
      throw new Error("Can only cancel pending invitations");
    }

    // Delete the invitation
    await ctx.db.delete(args.invitationId);

    return { success: true };
  },
});

// Update client status (pause, archive, activate)
export const updateClientStatus = mutation({
  args: {
    clientId: v.id("trainerClients"),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const trainer = await ctx.db
      .query("trainers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!trainer) {
      throw new Error("Trainer profile not found");
    }

    const client = await ctx.db.get(args.clientId);
    if (!client) {
      throw new Error("Client not found");
    }

    // Verify ownership
    if (client.trainerId !== trainer._id) {
      throw new Error("Not authorized");
    }

    // Can't change status of invited clients
    if (client.status === "invited") {
      throw new Error("Cannot change status of pending invitations");
    }

    await ctx.db.patch(args.clientId, {
      status: args.status,
    });

    return { success: true };
  },
});

// Accept invitation (public - called when client accepts)
export const acceptInvitation = action({
  args: {
    token: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    error?: string;
    trainerName?: string;
    requiresAuth?: boolean;
  }> => {
    const userId = await getAuthUserId(ctx);

    // Get the invitation
    const invitation = await ctx.runQuery(
      internal.clientInvitations.getInvitationByToken,
      { token: args.token }
    );

    if (!invitation) {
      return { success: false, error: "Invalid or expired invitation link" };
    }

    if (invitation.status !== "invited") {
      return { success: false, error: "This invitation has already been used" };
    }

    // Check if invitation has expired (7 days)
    const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    if (Date.now() - invitation.invitedAt > expirationTime) {
      return {
        success: false,
        error: "This invitation has expired. Please ask your trainer to send a new one.",
      };
    }

    // Get trainer info for display
    const trainer = await ctx.runQuery(
      internal.clientInvitations.getTrainerById,
      { trainerId: invitation.trainerId }
    );
    const trainerUser = trainer
      ? await ctx.runQuery(internal.users.getById, { userId: trainer.userId })
      : null;
    const trainerName =
      trainerUser?.name || trainer?.businessName || "Your trainer";

    // If user is not authenticated, tell them to sign in/up first
    if (!userId) {
      return {
        success: false,
        requiresAuth: true,
        trainerName,
        error: "Please sign in or create an account to accept this invitation",
      };
    }

    // Check if user already has a relationship with this trainer
    const existingRelation = await ctx.runQuery(
      internal.clientInvitations.getClientRelation,
      { trainerId: invitation.trainerId, clientId: userId }
    );
    if (existingRelation) {
      return {
        success: false,
        error: "You are already connected with this trainer",
      };
    }

    // Accept the invitation
    await ctx.runMutation(internal.clientInvitations.acceptInvitationMutation, {
      invitationId: invitation._id,
      clientId: userId,
    });

    return { success: true, trainerName };
  },
});

// Get invitation details by token (public - for showing invitation info)
export const getInvitationDetails = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("trainerClients")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .unique();

    if (!invitation || invitation.status !== "invited") {
      return null;
    }

    // Check expiration
    const expirationTime = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - invitation.invitedAt > expirationTime) {
      return { expired: true };
    }

    // Get trainer info
    const trainer = await ctx.db.get(invitation.trainerId);
    if (!trainer) {
      return null;
    }

    const trainerUser = await ctx.db.get(trainer.userId);

    return {
      expired: false,
      trainerName: trainerUser?.name || trainer.businessName || "Your trainer",
      trainerBusiness: trainer.businessName,
    };
  },
});

// Internal helper queries
export const getActiveClientCount = internalQuery({
  args: { trainerId: v.id("trainers") },
  handler: async (ctx, args) => {
    const clients = await ctx.db
      .query("trainerClients")
      .withIndex("by_trainer", (q) => q.eq("trainerId", args.trainerId))
      .collect();

    return clients.filter(
      (c) => c.status === "active" || c.status === "invited"
    ).length;
  },
});

export const getExistingInvitation = internalQuery({
  args: { trainerId: v.id("trainers"), clientEmail: v.string() },
  handler: async (ctx, args) => {
    const clients = await ctx.db
      .query("trainerClients")
      .withIndex("by_trainer", (q) => q.eq("trainerId", args.trainerId))
      .collect();

    return clients.find(
      (c) =>
        c.clientEmail.toLowerCase() === args.clientEmail.toLowerCase() &&
        (c.status === "invited" || c.status === "active")
    );
  },
});

export const getInvitationById = internalQuery({
  args: { invitationId: v.id("trainerClients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.invitationId);
  },
});

export const getTrainerById = internalQuery({
  args: { trainerId: v.id("trainers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.trainerId);
  },
});

export const getClientRelation = internalQuery({
  args: { trainerId: v.id("trainers"), clientId: v.id("users") },
  handler: async (ctx, args) => {
    const relations = await ctx.db
      .query("trainerClients")
      .withIndex("by_trainer", (q) => q.eq("trainerId", args.trainerId))
      .collect();

    return relations.find((r) => r.clientId === args.clientId);
  },
});

// Get pending invitations for the current user (client side)
export const getMyInvitations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const user = await ctx.db.get(userId);
    if (!user?.email) {
      return [];
    }

    // Find all pending invitations for this email
    const allInvitations = await ctx.db.query("trainerClients").collect();
    const pendingInvitations = allInvitations.filter(
      (inv) =>
        inv.clientEmail.toLowerCase() === user.email?.toLowerCase() &&
        inv.status === "invited"
    );

    // Get trainer details for each
    const invitationsWithTrainer = await Promise.all(
      pendingInvitations.map(async (inv) => {
        const trainer = await ctx.db.get(inv.trainerId);
        const trainerUser = trainer ? await ctx.db.get(trainer.userId) : null;
        return {
          ...inv,
          trainerName: trainerUser?.name || trainer?.businessName || "Trainer",
          trainerBusiness: trainer?.businessName,
        };
      })
    );

    return invitationsWithTrainer;
  },
});

// Accept invitation by ID (for clients who are already signed in)
export const acceptInvitationById = mutation({
  args: {
    invitationId: v.id("trainerClients"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "invited") {
      throw new Error("This invitation has already been processed");
    }

    // Verify the invitation is for this user's email
    const user = await ctx.db.get(userId);
    if (
      !user?.email ||
      invitation.clientEmail.toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new Error("This invitation is not for your email address");
    }

    // Accept the invitation
    await ctx.db.patch(args.invitationId, {
      clientId: userId,
      status: "active",
      acceptedAt: Date.now(),
      inviteToken: undefined,
    });

    return { success: true };
  },
});

// Decline invitation
export const declineInvitation = mutation({
  args: {
    invitationId: v.id("trainerClients"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "invited") {
      throw new Error("This invitation has already been processed");
    }

    // Verify the invitation is for this user's email
    const user = await ctx.db.get(userId);
    if (
      !user?.email ||
      invitation.clientEmail.toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new Error("This invitation is not for your email address");
    }

    // Archive the invitation (declined)
    await ctx.db.patch(args.invitationId, {
      status: "archived",
    });

    return { success: true };
  },
});
