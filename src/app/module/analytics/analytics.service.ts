import httpStatus from "http-status";
import { PaymentStatus, RiderVerificationStatus, ShipmentStatus } from "../../../generated/prisma/enums";
import type { IQuery } from "../../interfaces";
import type { RequestUser } from "../../middleware/checkAuth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, buildPagination } from "../../utils/queryHelper";

const getAdminAnalytics = async () => {
	const [
		totalCustomers,
		totalRiders,
		totalPendingRiderApplications,
		totalApprovedRiders,
		totalRejectedRiders,
		totalHubs,
		totalShipments,
		totalDeliveredShipments,
		totalCancelledShipments,
		totalFailedShipments,
		totalPendingShipments,
		totalInTransitShipments,
		revenueResult,
		refundResult,
	] = await Promise.all([
		prisma.customer.count({ where: { isDeleted: false } }),
		prisma.rider.count({ where: { isDeleted: false } }),
		prisma.rider.count({ where: { isDeleted: false, verificationStatus: RiderVerificationStatus.PENDING } }),
		prisma.rider.count({ where: { isDeleted: false, verificationStatus: RiderVerificationStatus.APPROVED } }),
		prisma.rider.count({ where: { isDeleted: false, verificationStatus: RiderVerificationStatus.REJECTED } }),
		prisma.hub.count({ where: { isDeleted: false } }),
		prisma.shipment.count({ where: { isDeleted: false } }),
		prisma.shipment.count({ where: { isDeleted: false, status: ShipmentStatus.DELIVERED } }),
		prisma.shipment.count({ where: { isDeleted: false, status: ShipmentStatus.CANCELLED } }),
		prisma.shipment.count({ where: { isDeleted: false, status: ShipmentStatus.FAILED } }),
		prisma.shipment.count({ where: { isDeleted: false, status: ShipmentStatus.PENDING } }),
		prisma.shipment.count({
			where: {
				isDeleted: false,
				status: { in: [ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY] },
			},
		}),
		prisma.payment.aggregate({ where: { status: PaymentStatus.PAID }, _sum: { amount: true } }),
		prisma.payment.aggregate({ where: { status: PaymentStatus.REFUNDED }, _sum: { amount: true } }),
	]);

	const totalRevenue = revenueResult._sum.amount?.toNumber() || 0;
	const totalRefunded = refundResult._sum.amount?.toNumber() || 0;

	return {
		totalCustomers,
		totalRiders,
		totalPendingRiderApplications,
		totalApprovedRiders,
		totalRejectedRiders,
		totalHubs,
		totalShipments,
		totalPendingShipments,
		totalInTransitShipments,
		totalDeliveredShipments,
		totalCancelledShipments,
		totalFailedShipments,
		totalRevenue,
		totalRefunded,
		netRevenue: totalRevenue - totalRefunded,
	};
};

const getCustomerAnalytics = async (user: RequestUser) => {
	const customer = await prisma.customer.findUnique({ where: { userId: user.userId } });

	if (!customer) {
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");
	}

	const [totalShipments, pendingShipments, inTransitShipments, deliveredShipments, cancelledShipments, spentResult] =
		await Promise.all([
			prisma.shipment.count({ where: { customerId: customer.id, isDeleted: false } }),
			prisma.shipment.count({
				where: { customerId: customer.id, isDeleted: false, status: ShipmentStatus.PENDING },
			}),
			prisma.shipment.count({
				where: {
					customerId: customer.id,
					isDeleted: false,
					status: { in: [ShipmentStatus.ASSIGNED, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY] },
				},
			}),
			prisma.shipment.count({
				where: { customerId: customer.id, isDeleted: false, status: ShipmentStatus.DELIVERED },
			}),
			prisma.shipment.count({
				where: { customerId: customer.id, isDeleted: false, status: ShipmentStatus.CANCELLED },
			}),
			prisma.payment.aggregate({
				where: { shipment: { customerId: customer.id }, status: PaymentStatus.PAID },
				_sum: { amount: true },
			}),
		]);

	return {
		totalShipments,
		pendingShipments,
		inTransitShipments,
		deliveredShipments,
		cancelledShipments,
		totalSpent: spentResult._sum.amount?.toNumber() || 0,
	};
};

const getRiderAnalytics = async (user: RequestUser) => {
	const rider = await prisma.rider.findUnique({ where: { userId: user.userId } });

	if (!rider) {
		throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");
	}

	const [assignedShipments, deliveredShipments, failedShipments, activeShipments] = await Promise.all([
		prisma.shipment.count({ where: { riderId: rider.id, isDeleted: false } }),
		prisma.shipment.count({ where: { riderId: rider.id, isDeleted: false, status: ShipmentStatus.DELIVERED } }),
		prisma.shipment.count({ where: { riderId: rider.id, isDeleted: false, status: ShipmentStatus.FAILED } }),
		prisma.shipment.count({
			where: {
				riderId: rider.id,
				isDeleted: false,
				status: { in: [ShipmentStatus.ASSIGNED, ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY] },
			},
		}),
	]);

	return {
		assignedShipments,
		deliveredShipments,
		failedShipments,
		activeShipments,
		rating: rider.rating,
		isAvailable: rider.isAvailable,
	};
};

const getAuditLogs = async (query: IQuery) => {
	const { page, limit, skip, orderBy } = buildPagination(query);

	const where = query.shipmentId ? { shipmentId: query.shipmentId as string } : {};

	const [logs, total] = await prisma.$transaction([
		prisma.trackingEvent.findMany({
			where,
			skip,
			take: limit,
			orderBy,
			include: { shipment: { select: { trackingCode: true } } },
		}),
		prisma.trackingEvent.count({ where }),
	]);

	return { data: logs, meta: buildMeta(page, limit, total) };
};

export const AnalyticsServices = {
	getAdminAnalytics,
	getCustomerAnalytics,
	getRiderAnalytics,
	getAuditLogs,
};
