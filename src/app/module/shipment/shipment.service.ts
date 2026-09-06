import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	PaymentMethod,
	PaymentStatus,
	RiderVerificationStatus,
	Role,
	ShipmentStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, buildPagination } from "../../utils/queryHelper";
import type {
	IAssignRiderPayload,
	ICancelShipmentPayload,
	ICreateShipmentPayload,
	IUpdateShipmentStatusPayload,
} from "./shipment.interface";

// Which statuses a shipment may move to next via the "update status" endpoint
// (ASSIGNED is only reachable via the dedicated assign-rider endpoint, and
// CANCELLED is only reachable via the dedicated cancel endpoint.)
const STATUS_TRANSITIONS: Record<string, ShipmentStatus[]> = {
	[ShipmentStatus.ASSIGNED]: [ShipmentStatus.PICKED_UP],
	[ShipmentStatus.PICKED_UP]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.FAILED],
	[ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.FAILED],
	[ShipmentStatus.OUT_FOR_DELIVERY]: [ShipmentStatus.DELIVERED, ShipmentStatus.FAILED],
	[ShipmentStatus.FAILED]: [ShipmentStatus.RETURNED],
};

const generateTrackingCode = () => {
	const year = new Date().getFullYear();
	const random = Math.floor(100000 + Math.random() * 900000);
	return `CR-${year}-${random}`;
};

const calculateDeliveryFee = (weightKg: number, distanceKm?: number) => {
	const base = Number(config.base_delivery_fee);
	const perKg = Number(config.per_kg_fee) * weightKg;
	const perKm = distanceKm ? Number(config.per_km_fee) * distanceKm : 0;

	return Math.round((base + perKg + perKm) * 100) / 100;
};

const createShipment = async (userId: string, payload: ICreateShipmentPayload) => {
	const customer = await prisma.customer.findUnique({ where: { userId } });

	if (!customer) {
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");
	}

	if (payload.originHubId === payload.destinationHubId) {
		throw new AppError(httpStatus.BAD_REQUEST, "Origin and destination hub cannot be the same");
	}

	const [originHub, destinationHub] = await Promise.all([
		prisma.hub.findUnique({ where: { id: payload.originHubId } }),
		prisma.hub.findUnique({ where: { id: payload.destinationHubId } }),
	]);

	if (!originHub || originHub.isDeleted || !originHub.isActive) {
		throw new AppError(httpStatus.BAD_REQUEST, "Origin hub is invalid or inactive");
	}

	if (!destinationHub || destinationHub.isDeleted || !destinationHub.isActive) {
		throw new AppError(httpStatus.BAD_REQUEST, "Destination hub is invalid or inactive");
	}

	const isCod = payload.isCod ?? false;

	if (isCod && (!payload.codAmount || payload.codAmount <= 0)) {
		throw new AppError(httpStatus.BAD_REQUEST, "codAmount is required and must be greater than 0 for COD shipments");
	}

	const deliveryFee = calculateDeliveryFee(payload.weightKg, payload.distanceKm);

	const shipment = await prisma.$transaction(async (tx) => {
		const created = await tx.shipment.create({
			data: {
				trackingCode: generateTrackingCode(),
				parcelType: payload.parcelType,
				parcelDescription: payload.parcelDescription,
				weightKg: payload.weightKg,
				pickupAddress: payload.pickupAddress,
				pickupContactName: payload.pickupContactName,
				pickupContactPhone: payload.pickupContactPhone,
				deliveryAddress: payload.deliveryAddress,
				deliveryContactName: payload.deliveryContactName,
				deliveryContactPhone: payload.deliveryContactPhone,
				distanceKm: payload.distanceKm,
				deliveryFee,
				isCod,
				codAmount: isCod ? payload.codAmount : 0,
				scheduledPickupAt: payload.scheduledPickupAt ? new Date(payload.scheduledPickupAt) : undefined,
				customerId: customer.id,
				originHubId: payload.originHubId,
				destinationHubId: payload.destinationHubId,
			},
		});

		await tx.trackingEvent.create({
			data: {
				shipmentId: created.id,
				status: ShipmentStatus.PENDING,
				note: "Shipment created. Awaiting rider assignment.",
				updatedByUserId: userId,
			},
		});

		return created;
	});

	return shipment;
};

const buildShipmentWhere = (query: IQuery): Prisma.ShipmentWhereInput => {
	const andConditions: Prisma.ShipmentWhereInput[] = [{ isDeleted: false }];

	if (query.status) {
		andConditions.push({ status: query.status as ShipmentStatus });
	}

	if (query.customerId) {
		andConditions.push({ customerId: query.customerId as string });
	}

	if (query.riderId) {
		andConditions.push({ riderId: query.riderId as string });
	}

	if (query.originHubId) {
		andConditions.push({ originHubId: query.originHubId as string });
	}

	if (query.destinationHubId) {
		andConditions.push({ destinationHubId: query.destinationHubId as string });
	}

	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ trackingCode: { contains: query.searchTerm as string, mode: "insensitive" } },
				{ deliveryContactName: { contains: query.searchTerm as string, mode: "insensitive" } },
				{ pickupContactName: { contains: query.searchTerm as string, mode: "insensitive" } },
			],
		});
	}

	return { AND: andConditions };
};

const getAllShipments = async (query: IQuery) => {
	const { page, limit, skip, orderBy } = buildPagination(query);
	const where = buildShipmentWhere(query);

	const [shipments, total] = await prisma.$transaction([
		prisma.shipment.findMany({
			where,
			skip,
			take: limit,
			orderBy,
			include: { customer: true, rider: true, originHub: true, destinationHub: true, payment: true },
		}),
		prisma.shipment.count({ where }),
	]);

	return { data: shipments, meta: buildMeta(page, limit, total) };
};

const getMyShipments = async (userId: string, query: IQuery) => {
	const customer = await prisma.customer.findUnique({ where: { userId } });

	if (!customer) {
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");
	}

	const { page, limit, skip, orderBy } = buildPagination(query);
	const where = buildShipmentWhere({ ...query, customerId: customer.id });

	const [shipments, total] = await prisma.$transaction([
		prisma.shipment.findMany({
			where,
			skip,
			take: limit,
			orderBy,
			include: { rider: true, originHub: true, destinationHub: true, payment: true },
		}),
		prisma.shipment.count({ where }),
	]);

	return { data: shipments, meta: buildMeta(page, limit, total) };
};

const getShipmentById = async (
	shipmentId: string,
	requestUser: { userId: string; role: Role },
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: {
			customer: true,
			rider: true,
			originHub: true,
			destinationHub: true,
			payment: true,
			trackingEvents: { orderBy: { createdAt: "desc" } },
		},
	});

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (requestUser.role === Role.CUSTOMER && shipment.customer.userId !== requestUser.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have access to this shipment");
	}

	if (requestUser.role === Role.RIDER && shipment.rider?.userId !== requestUser.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have access to this shipment");
	}

	return shipment;
};

const trackShipmentByCode = async (trackingCode: string) => {
	const shipment = await prisma.shipment.findUnique({
		where: { trackingCode },
		select: {
			trackingCode: true,
			status: true,
			parcelType: true,
			pickupAddress: true,
			deliveryAddress: true,
			scheduledPickupAt: true,
			pickedUpAt: true,
			outForDeliveryAt: true,
			deliveredAt: true,
			createdAt: true,
			originHub: { select: { name: true, zone: true } },
			destinationHub: { select: { name: true, zone: true } },
			trackingEvents: {
				orderBy: { createdAt: "desc" },
				select: { status: true, note: true, createdAt: true },
			},
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "No shipment found with this tracking code");
	}

	return shipment;
};

const assignRider = async (shipmentId: string, adminUserId: string, payload: IAssignRiderPayload) => {
	const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (![ShipmentStatus.PENDING, ShipmentStatus.FAILED].includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot assign a rider to a shipment with status ${shipment.status}`,
		);
	}

	const rider = await prisma.rider.findUnique({ where: { id: payload.riderId } });

	if (!rider || rider.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Rider not found");
	}

	if (rider.verificationStatus !== RiderVerificationStatus.APPROVED) {
		throw new AppError(httpStatus.BAD_REQUEST, "This rider is not an approved rider");
	}

	if (!rider.isAvailable) {
		throw new AppError(httpStatus.BAD_REQUEST, "This rider is currently unavailable");
	}

	const updatedShipment = await prisma.$transaction(async (tx) => {
		// Optimistic concurrency: only update if the status hasn't changed since we read it.
		const updateResult = await tx.shipment.updateMany({
			where: { id: shipmentId, status: shipment.status },
			data: { riderId: rider.id, status: ShipmentStatus.ASSIGNED, failureReason: null },
		});

		if (updateResult.count === 0) {
			throw new AppError(
				httpStatus.CONFLICT,
				"This shipment was updated by someone else. Please refresh and try again.",
			);
		}

		await tx.trackingEvent.create({
			data: {
				shipmentId,
				status: ShipmentStatus.ASSIGNED,
				note: payload.note ?? `Assigned to rider ${rider.name}`,
				updatedByUserId: adminUserId,
				updatedByRole: Role.ADMIN,
			},
		});

		return tx.shipment.findUniqueOrThrow({
			where: { id: shipmentId },
			include: { rider: true, customer: true, originHub: true, destinationHub: true },
		});
	});

	return updatedShipment;
};

const updateShipmentStatus = async (
	shipmentId: string,
	requestUser: { userId: string; name: string; role: Role },
	payload: IUpdateShipmentStatusPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { rider: true },
	});

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (requestUser.role === Role.RIDER && shipment.rider?.userId !== requestUser.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "This shipment is not assigned to you");
	}

	const allowedNextStatuses = STATUS_TRANSITIONS[shipment.status] ?? [];

	if (!allowedNextStatuses.includes(payload.status as ShipmentStatus)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot move shipment from ${shipment.status} to ${payload.status}`,
		);
	}

	const timestampField: Record<string, string> = {
		PICKED_UP: "pickedUpAt",
		OUT_FOR_DELIVERY: "outForDeliveryAt",
		DELIVERED: "deliveredAt",
	};

	const updatedShipment = await prisma.$transaction(async (tx) => {
		const updateData: Prisma.ShipmentUpdateInput = { status: payload.status as ShipmentStatus };

		const dateField = timestampField[payload.status];
		if (dateField) {
			(updateData as Record<string, unknown>)[dateField] = new Date();
		}

		if (payload.status === "FAILED") {
			updateData.failureReason = payload.failureReason;
		}

		const updateResult = await tx.shipment.updateMany({
			where: { id: shipmentId, status: shipment.status },
			data: updateData,
		});

		if (updateResult.count === 0) {
			throw new AppError(
				httpStatus.CONFLICT,
				"This shipment was updated by someone else. Please refresh and try again.",
			);
		}

		await tx.trackingEvent.create({
			data: {
				shipmentId,
				status: payload.status as ShipmentStatus,
				note: payload.note ?? payload.failureReason,
				updatedByUserId: requestUser.userId,
				updatedByName: requestUser.name,
				updatedByRole: requestUser.role,
			},
		});

		if (shipment.riderId) {
			if (payload.status === "DELIVERED") {
				await tx.rider.update({
					where: { id: shipment.riderId },
					data: { totalDeliveries: { increment: 1 }, isAvailable: true },
				});
			} else if (payload.status === "FAILED") {
				await tx.rider.update({
					where: { id: shipment.riderId },
					data: { totalFailed: { increment: 1 }, isAvailable: true },
				});
			}
		}

		if (payload.status === "DELIVERED" && shipment.isCod) {
			await tx.payment.upsert({
				where: { shipmentId },
				create: {
					shipmentId,
					amount: shipment.codAmount,
					method: PaymentMethod.COD,
					status: PaymentStatus.PAID,
					merchantInvoiceNumber: shipment.trackingCode,
					paidAt: new Date().toISOString(),
				},
				update: { status: PaymentStatus.PAID, paidAt: new Date().toISOString() },
			});
		}

		return tx.shipment.findUniqueOrThrow({
			where: { id: shipmentId },
			include: { rider: true, customer: true, originHub: true, destinationHub: true, payment: true },
		});
	});

	return updatedShipment;
};

const cancelShipment = async (
	shipmentId: string,
	userId: string,
	payload: ICancelShipmentPayload,
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { customer: true },
	});

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (shipment.customer.userId !== userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have access to this shipment");
	}

	if (![ShipmentStatus.PENDING, ShipmentStatus.ASSIGNED].includes(shipment.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot cancel a shipment that is already ${shipment.status}`,
		);
	}

	const updatedShipment = await prisma.$transaction(async (tx) => {
		const updateResult = await tx.shipment.updateMany({
			where: { id: shipmentId, status: shipment.status },
			data: { status: ShipmentStatus.CANCELLED, cancelReason: payload.cancelReason },
		});

		if (updateResult.count === 0) {
			throw new AppError(
				httpStatus.CONFLICT,
				"This shipment was updated by someone else. Please refresh and try again.",
			);
		}

		if (shipment.riderId) {
			await tx.rider.update({ where: { id: shipment.riderId }, data: { isAvailable: true } });
		}

		await tx.trackingEvent.create({
			data: {
				shipmentId,
				status: ShipmentStatus.CANCELLED,
				note: payload.cancelReason ?? "Cancelled by customer",
				updatedByUserId: userId,
				updatedByRole: Role.CUSTOMER,
			},
		});

		return tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
	});

	return updatedShipment;
};

const deleteShipment = async (shipmentId: string) => {
	const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	const deletedShipment = await prisma.shipment.update({
		where: { id: shipmentId },
		data: { isDeleted: true, deletedAt: new Date() },
	});

	return deletedShipment;
};

export const ShipmentServices = {
	createShipment,
	getAllShipments,
	getMyShipments,
	getShipmentById,
	trackShipmentByCode,
	assignRider,
	updateShipmentStatus,
	cancelShipment,
	deleteShipment,
};
