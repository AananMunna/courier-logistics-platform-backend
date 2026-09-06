import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { RiderVerificationStatus, ShipmentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import type { IQuery } from "../../interfaces";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, buildPagination } from "../../utils/queryHelper";
import ejs from "ejs";
import path from "path";
import type { IUpdateRiderProfilePayload, IVerifyRiderPayload } from "./rider.interface";

const getAllRiders = async (query: IQuery) => {
	const { page, limit, skip, orderBy } = buildPagination(query);

	const andConditions: Prisma.RiderWhereInput[] = [{ isDeleted: false }];

	if (query.verificationStatus) {
		andConditions.push({ verificationStatus: query.verificationStatus as RiderVerificationStatus });
	}

	if (query.zone) {
		andConditions.push({ currentZone: { equals: query.zone as string, mode: "insensitive" } });
	}

	if (query.isAvailable !== undefined) {
		andConditions.push({ isAvailable: query.isAvailable === "true" });
	}

	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ name: { contains: query.searchTerm, mode: "insensitive" } },
				{ email: { contains: query.searchTerm, mode: "insensitive" } },
				{ vehicleRegistrationNumber: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}

	const where: Prisma.RiderWhereInput = { AND: andConditions };

	const [riders, total] = await prisma.$transaction([
		prisma.rider.findMany({ where, skip, take: limit, orderBy }),
		prisma.rider.count({ where }),
	]);

	return { data: riders, meta: buildMeta(page, limit, total) };
};

const getSingleRider = async (riderId: string) => {
	const rider = await prisma.rider.findUnique({ where: { id: riderId } });

	if (!rider || rider.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Rider not found");
	}

	return rider;
};

const verifyRider = async (riderId: string, reviewerName: string, payload: IVerifyRiderPayload) => {
	const rider = await prisma.rider.findUnique({ where: { id: riderId } });

	if (!rider || rider.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Rider not found");
	}

	if (rider.verificationStatus !== RiderVerificationStatus.PENDING) {
		throw new AppError(httpStatus.BAD_REQUEST, "This rider application has already been reviewed");
	}

	const updatedRider = await prisma.rider.update({
		where: { id: riderId },
		data: {
			verificationStatus: payload.verificationStatus,
			rejectionReason: payload.verificationStatus === "REJECTED" ? payload.rejectionReason : null,
			reviewedBy: reviewerName,
			reviewedAt: new Date(),
		},
	});

	const templateName =
		payload.verificationStatus === "APPROVED" ? "rider-application-approved" : "rider-application-rejected";

	const templatePath = path.join(process.cwd(), `src/app/templates/${templateName}.ejs`);
	const html = await ejs.renderFile(templatePath, {
		name: rider.name,
		rejectionReason: payload.rejectionReason,
	});

	await transporter.sendMail({
		from: config.email_sender,
		to: rider.email,
		subject: payload.verificationStatus === "APPROVED" ? "Rider Application Approved" : "Rider Application Rejected",
		html,
	});

	return updatedRider;
};

const getMyProfile = async (userId: string) => {
	const rider = await prisma.rider.findUnique({ where: { userId } });

	if (!rider) {
		throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");
	}

	return rider;
};

const updateMyProfile = async (userId: string, payload: IUpdateRiderProfilePayload) => {
	const rider = await prisma.rider.findUnique({ where: { userId } });

	if (!rider || rider.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");
	}

	if (rider.verificationStatus !== RiderVerificationStatus.APPROVED && payload.isAvailable !== undefined) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account must be approved before you can go online");
	}

	const updatedRider = await prisma.rider.update({
		where: { userId },
		data: payload,
	});

	return updatedRider;
};

const getMyAssignedShipments = async (userId: string, query: IQuery) => {
	const rider = await prisma.rider.findUnique({ where: { userId } });

	if (!rider) {
		throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");
	}

	const { page, limit, skip, orderBy } = buildPagination(query);

	const andConditions: Prisma.ShipmentWhereInput[] = [{ riderId: rider.id, isDeleted: false }];

	if (query.status) {
		andConditions.push({ status: query.status as ShipmentStatus });
	}

	const where: Prisma.ShipmentWhereInput = { AND: andConditions };

	const [shipments, total] = await prisma.$transaction([
		prisma.shipment.findMany({
			where,
			skip,
			take: limit,
			orderBy,
			include: { originHub: true, destinationHub: true, customer: true },
		}),
		prisma.shipment.count({ where }),
	]);

	return { data: shipments, meta: buildMeta(page, limit, total) };
};

const getMyEarnings = async (userId: string) => {
	const rider = await prisma.rider.findUnique({ where: { userId } });

	if (!rider) {
		throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");
	}

	const RIDER_COMMISSION_RATE = 0.7;

	const deliveredShipments = await prisma.shipment.findMany({
		where: { riderId: rider.id, status: "DELIVERED", isDeleted: false },
		select: { id: true, trackingCode: true, deliveryFee: true, deliveredAt: true },
		orderBy: { deliveredAt: "desc" },
	});

	const totalDeliveryFee = deliveredShipments.reduce((sum, s) => sum + Number(s.deliveryFee), 0);
	const totalEarnings = totalDeliveryFee * RIDER_COMMISSION_RATE;

	return {
		totalDeliveredShipments: deliveredShipments.length,
		totalDeliveryFeeCollected: totalDeliveryFee,
		commissionRate: RIDER_COMMISSION_RATE,
		totalEarnings,
		rating: rider.rating,
		recentDeliveries: deliveredShipments.slice(0, 10),
	};
};

export const RiderServices = {
	getAllRiders,
	getSingleRider,
	verifyRider,
	getMyProfile,
	updateMyProfile,
	getMyAssignedShipments,
	getMyEarnings,
};
