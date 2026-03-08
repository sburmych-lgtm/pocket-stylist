import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../services/prisma.js";
import { isFamilyAdmin, isFamilyMember } from "../services/family.js";

export const familyRouter = Router();

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
    const { name } = req.body as { name: string };

    if (!name?.trim()) {
      res.status(400).json({ error: "Family name is required" });
      return;
    }

    const family = await prisma.family.create({
      data: {
        name: name.trim(),
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
    const { name } = req.body as { name: string };

    if (!(await isFamilyAdmin(userId, familyId))) {
      res.status(403).json({ error: "Only admins can update family" });
      return;
    }

    const family = await prisma.family.update({
      where: { id: familyId },
      data: { name: name.trim() },
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
    const { email, role = "member" } = req.body as {
      email: string;
      role?: string;
    };

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

      if (!(await isFamilyMember(userId, familyId))) {
        res.status(403).json({ error: "Not a member of this family" });
        return;
      }

      const items = await prisma.wardrobeItem.findMany({
        where: { userId: memberId },
        orderBy: { createdAt: "desc" },
      });

      res.json({ items });
    } catch (err) {
      console.error("Family wardrobe error:", err);
      res.status(500).json({ error: "Failed to fetch member wardrobe" });
    }
  },
);
