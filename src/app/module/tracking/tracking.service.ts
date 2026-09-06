import httpStatus from "http-status";
import type { Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IAddTrackingNotePayload } from "./tracking.interface";

const getTimeline = async (
	shipmentId: string,
	requestUser: { userId: string; role: Role },
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { customer: true, rider: true },
	});

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (requestUser.role === "CUSTOMER" && shipment.customer.userId !== requestUser.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have access to this shipment");
	}

	if (requestUser.role === "RIDER" && shipment.rider?.userId !== requestUser.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have access to this shipment");
	}

	const events = await prisma.trackingEvent.findMany({
		where: { shipmentId },
		orderBy: { createdAt: "desc" },
	});

	return events;
};

const addNote = async (
	shipmentId: string,
	requestUser: { userId: string; name: string; role: Role },
	payload: IAddTrackingNotePayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { rider: true },
	});

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (requestUser.role === "RIDER" && shipment.rider?.userId !== requestUser.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "This shipment is not assigned to you");
	}

	const event = await prisma.trackingEvent.create({
		data: {
			shipmentId,
			status: shipment.status,
			note: payload.note,
			updatedByUserId: requestUser.userId,
			updatedByName: requestUser.name,
			updatedByRole: requestUser.role,
		},
	});

	return event;
};

export const TrackingServices = {
	getTimeline,
	addNote,
};
