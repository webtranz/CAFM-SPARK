import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import {
  cleanLostFoundText,
  lostFoundReturnDateForStatus,
  normalizeLostFoundCaseType,
  normalizeLostFoundStatus,
} from "@/lib/lost-found";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().optional(),
  caseType: z.string().optional(),
  lostItems: z.string().optional(),
  lostDate: z.string().optional(),
  foundBy: z.string().optional(),
  itemFound: z.string().optional(),
  location: z.string().optional(),
  guestName: z.string().optional(),
  guestRoomBadge: z.string().optional(),
  guestContact: z.string().optional(),
  status: z.string().optional(),
});

class LostFoundInputError extends Error {
  status = 400;
}

function dateInput(value: unknown) {
  const text = cleanLostFoundText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new LostFoundInputError("Select a valid date.");
  }
  return date;
}

async function nextLostFoundCaseId(caseType: "LOST" | "FOUND") {
  const prefix = caseType === "LOST" ? "LF-L" : "LF-F";
  const count = await prisma.lostFoundCase.count({ where: { caseType } });
  for (let offset = 1; offset <= 25000; offset += 1) {
    const caseId = `${prefix}-${String(count + offset).padStart(5, "0")}`;
    const existing = await prisma.lostFoundCase.findUnique({
      where: { caseId },
      select: { id: true },
    });
    if (!existing) return caseId;
  }
  return `${prefix}-${Date.now()}`;
}

export async function GET() {
  try {
    const { error } = await requirePermission("incidents.view");
    if (error) return error;
    const cases = await prisma.lostFoundCase.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
    return NextResponse.json({ cases });
  } catch (error) {
    return apiError(error, "Unable to load lost and found cases");
  }
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requirePermission("incidents.create");
    if (error) return error;
    const input = schema.parse(await request.json());
    const caseType = normalizeLostFoundCaseType(input.caseType);
    const actor = user?.name || user?.email || "System";

    if (caseType === "LOST") {
      const lostItems = cleanLostFoundText(input.lostItems);
      const location = cleanLostFoundText(input.location);
      const lostDate = dateInput(input.lostDate);
      if (!lostItems) throw new LostFoundInputError("Lost item details are required.");
      if (!lostDate) throw new LostFoundInputError("Lost date is required.");
      if (!location) throw new LostFoundInputError("Lost location is required.");
      const status = normalizeLostFoundStatus(caseType, input.status);
      const created = await prisma.lostFoundCase.create({
        data: {
          caseId: await nextLostFoundCaseId(caseType),
          caseType,
          lostItems,
          lostDate,
          location,
          guestName: cleanLostFoundText(input.guestName) || null,
          guestRoomBadge: cleanLostFoundText(input.guestRoomBadge) || null,
          guestContact: cleanLostFoundText(input.guestContact) || null,
          status,
          returnDate: lostFoundReturnDateForStatus(caseType, status),
          createdBy: actor,
          updatedBy: actor,
        },
      });
      await auditAction({ user, action: "LOST_FOUND_CREATE", entity: "lost_found", entityId: created.id, details: { createdRecord: created } });
      return NextResponse.json(created, { status: 201 });
    }

    const foundBy = cleanLostFoundText(input.foundBy);
    const itemFound = cleanLostFoundText(input.itemFound);
    const location = cleanLostFoundText(input.location);
    if (!foundBy) throw new LostFoundInputError("Found by is required.");
    if (!itemFound) throw new LostFoundInputError("Found item details are required.");
    if (!location) throw new LostFoundInputError("Found location is required.");
    const status = normalizeLostFoundStatus(caseType, input.status);
    const now = new Date();
    const created = await prisma.lostFoundCase.create({
      data: {
        caseId: await nextLostFoundCaseId(caseType),
        caseType,
        foundAt: now,
        foundBy,
        itemFound,
        location,
        guestName: cleanLostFoundText(input.guestName) || null,
        guestRoomBadge: cleanLostFoundText(input.guestRoomBadge) || null,
        guestContact: cleanLostFoundText(input.guestContact) || null,
        status,
        returnDate: lostFoundReturnDateForStatus(caseType, status, null, now),
        createdBy: actor,
        updatedBy: actor,
      },
    });
    await auditAction({ user, action: "LOST_FOUND_CREATE", entity: "lost_found", entityId: created.id, details: { createdRecord: created } });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error, "Unable to save lost and found case", (error as { status?: number })?.status);
  }
}

export async function PATCH(request: Request) {
  try {
    const { error, user } = await requirePermission("incidents.edit");
    if (error) return error;
    const input = schema.parse(await request.json());
    const id = cleanLostFoundText(input.id);
    if (!id) throw new LostFoundInputError("Lost and found case id is required.");
    const current = await prisma.lostFoundCase.findUnique({ where: { id } });
    if (!current) throw new LostFoundInputError("Lost and found case not found.");
    const caseType = normalizeLostFoundCaseType(current.caseType);
    const status = normalizeLostFoundStatus(caseType, input.status, current.status);
    const actor = user?.name || user?.email || "System";
    const updated = await prisma.lostFoundCase.update({
      where: { id },
      data: {
        ...(caseType === "LOST" ? {
          lostItems: cleanLostFoundText(input.lostItems) || current.lostItems,
          lostDate: input.lostDate ? dateInput(input.lostDate) : current.lostDate,
        } : {
          foundBy: cleanLostFoundText(input.foundBy) || current.foundBy,
          itemFound: cleanLostFoundText(input.itemFound) || current.itemFound,
        }),
        location: cleanLostFoundText(input.location) || current.location,
        guestName: cleanLostFoundText(input.guestName) || current.guestName,
        guestRoomBadge: cleanLostFoundText(input.guestRoomBadge) || current.guestRoomBadge,
        guestContact: cleanLostFoundText(input.guestContact) || current.guestContact,
        status,
        returnDate: lostFoundReturnDateForStatus(caseType, status, current.returnDate),
        updatedBy: actor,
      },
    });
    await auditAction({ user, action: "LOST_FOUND_UPDATE", entity: "lost_found", entityId: updated.id, details: { previousRecord: current, updatedRecord: updated } });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, "Unable to update lost and found case", (error as { status?: number })?.status);
  }
}

