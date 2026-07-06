import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import {
  isFamilyAdmin,
  isFamilyMember,
  wardrobeVisibilityWhere,
} from "../services/family.js";

export const familyRouter = Router();

const FamilyNameSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const AddMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["member", "admin"]).optional(),
});

/** Extract a single-value param from Express 5 (string | string[]) */
function param(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val ?? "";
}

const MEMBER_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

// GET / — list user's families with members
familyRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const memberships = await prisma.familyMember.findMany({
      where: { userId },
      include: {
        family: {
          include: {
            members: {
              include: { user: { select: MEMBER_USER_SELECT } },
            },
          },
        },
      },
    });

    const families = memberships.map((m) => ({
      ...m.family,
      myRole: m.role,
    }));

    res.json({ families });
  } catch (err) {
    console.error("Family list error:", err);
    res.status(500).json({ error: "Failed to list families" });
  }
});

// POST / — create new family
familyRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const parsed = FamilyNameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Family name is required" });
      return;
    }

    const family = await prisma.family.create({
      data: {
        name: parsed.data.name,
        members: { create: { userId, role: "owner" } },
      },
      include: {
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
      },
    });

    res.json({ family: { ...family, myRole: "owner" } });
  } catch (err) {
    console.error("Family create error:", err);
    res.status(500).json({ error: "Failed to create family" });
  }
});

// PATCH /:familyId — update family name
familyRouter.patch("/:familyId", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const familyId = param(req.params.familyId);
    const parsed = FamilyNameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }

    if (!(await isFamilyAdmin(userId, familyId))) {
      res.status(403).json({ error: "Only admins can update family" });
      return;
    }

    const family = await prisma.family.update({
      where: { id: familyId },
      data: { name: parsed.data.name },
    });

    res.json({ family });
  } catch (err) {
    console.error("Family update error:", err);
    res.status(500).json({ error: "Failed to update family" });
  }
});

// DELETE /:familyId — delete family (owner only)
familyRouter.delete("/:familyId", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const familyId = param(req.params.familyId);

    const member = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });

    if (member?.role !== "owner") {
      res.status(403).json({ error: "Only owner can delete family" });
      return;
    }

    await prisma.family.delete({ where: { id: familyId } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Family delete error:", err);
    res.status(500).json({ error: "Failed to delete family" });
  }
});

// POST /:familyId/members — add member by email
familyRouter.post("/:familyId/members", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const familyId = param(req.params.familyId);
    const parsed = AddMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const { email, role = "member" } = parsed.data;

    if (!(await isFamilyAdmin(userId, familyId))) {
      res.status(403).json({ error: "Only admins can add members" });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { email },
      select: MEMBER_USER_SELECT,
    });

    if (!targetUser) {
      res.status(404).json({
        error: "User not found. They must sign up first.",
      });
      return;
    }

    const existing = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId: targetUser.id } },
    });

    if (existing) {
      res.status(409).json({ error: "User is already a member" });
      return;
    }

    const membership = await prisma.familyMember.create({
      data: {
        familyId,
        userId: targetUser.id,
        role: role === "admin" ? "admin" : "member",
      },
      include: { user: { select: MEMBER_USER_SELECT } },
    });

    res.json({ member: membership });
  } catch (err) {
    console.error("Family add member error:", err);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// DELETE /:familyId/members/:targetUserId — remove member
familyRouter.delete(
  "/:familyId/members/:targetUserId",
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const familyId = param(req.params.familyId);
      const targetUserId = param(req.params.targetUserId);

      if (targetUserId !== userId) {
        if (!(await isFamilyAdmin(userId, familyId))) {
          res
            .status(403)
            .json({ error: "Only admins can remove other members" });
          return;
        }

        const targetMember = await prisma.familyMember.findUnique({
          where: { familyId_userId: { familyId, userId: targetUserId } },
        });
        if (targetMember?.role === "owner") {
          res.status(403).json({ error: "Cannot remove the owner" });
          return;
        }
      } else {
        const selfMember = await prisma.familyMember.findUnique({
          where: { familyId_userId: { familyId, userId } },
        });
        if (!selfMember) {
          res.status(404).json({ error: "membership_not_found" });
          return;
        }
        if (selfMember.role === "owner") {
          res.status(409).json({ error: "owner_must_delete_family" });
          return;
        }
      }

      await prisma.familyMember.delete({
        where: { familyId_userId: { familyId, userId: targetUserId } },
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Family remove member error:", err);
      res.status(500).json({ error: "Failed to remove member" });
    }
  },
);

// GET /:familyId/members/:memberId/wardrobe — view family member's wardrobe
familyRouter.get(
  "/:familyId/members/:memberId/wardrobe",
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const familyId = param(req.params.familyId);
      const memberId = param(req.params.memberId);

      // IDOR fix: confirm BOTH parties belong to the SAME family. Previously
      // we only checked that the caller was a member of `familyId`, which
      // meant any authenticated user in any family could trivially read
      // any other user's wardrobe by passing their own familyId + the
      // victim's userId.
      const [callerIsMember, targetIsMember] = await Promise.all([
        isFamilyMember(userId, familyId),
        isFamilyMember(memberId, familyId),
      ]);

      if (!callerIsMember) {
        res.status(403).json({ error: "Not a member of this family" });
        return;
      }
      if (!targetIsMember) {
        // 404 (not 403) so we don't leak the existence of an unrelated user.
        res.status(404).json({ error: "Member not found in this family" });
        return;
      }

      const items = await prisma.wardrobeItem.findMany({
        where: wardrobeVisibilityWhere(userId, memberId),
        orderBy: { createdAt: "desc" },
      });

      res.json({ items });
    } catch (err) {
      console.error("Family wardrobe error:", err);
      res.status(500).json({ error: "Failed to fetch member wardrobe" });
    }
  },
);
