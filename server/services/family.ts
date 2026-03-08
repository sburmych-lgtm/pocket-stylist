import { prisma } from "./prisma.js";

/** Check if userId is a member of familyId */
export async function isFamilyMember(
  userId: string,
  familyId: string,
): Promise<boolean> {
  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId } },
  });
  return !!member;
}

/** Check if userId is admin/owner of familyId */
export async function isFamilyAdmin(
  userId: string,
  familyId: string,
): Promise<boolean> {
  const member = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId } },
  });
  return member?.role === "owner" || member?.role === "admin";
}

/** Verify that requestor can view target user's wardrobe (same family) */
export async function canViewMemberWardrobe(
  requestorId: string,
  targetUserId: string,
): Promise<boolean> {
  if (requestorId === targetUserId) return true;

  const requestorFamilies = await prisma.familyMember.findMany({
    where: { userId: requestorId },
    select: { familyId: true },
  });

  if (requestorFamilies.length === 0) return false;

  const shared = await prisma.familyMember.findFirst({
    where: {
      userId: targetUserId,
      familyId: { in: requestorFamilies.map((f) => f.familyId) },
    },
  });

  return !!shared;
}

/** Resolve targetUserId from optional memberId query param */
export async function resolveTargetUser(
  requestorId: string,
  memberId: string | undefined,
): Promise<{ targetUserId: string; error?: string }> {
  if (!memberId || memberId === requestorId) {
    return { targetUserId: requestorId };
  }

  const allowed = await canViewMemberWardrobe(requestorId, memberId);
  if (!allowed) {
    return { targetUserId: requestorId, error: "Not in the same family" };
  }

  return { targetUserId: memberId };
}
