import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { PaymentMethod, PaymentStatus, Role } from "../../../generated/prisma/enums";
import config from "../../config";
import type { IQuery } from "../../interfaces";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, buildPagination } from "../../utils/queryHelper";
import type { IInitiatePaymentPayload, IRefundPaymentPayload } from "./payment.interface";

const bkashHeaders = async () => {
	const idToken = await getBkashIdToken();

	return {
		"Content-Type": "application/json",
		Accept: "application/json",
		Authorization: idToken as string,
		"X-APP-Key": config.bkash_app_key,
	};
};

const initiatePayment = async (userId: string, payload: IInitiatePaymentPayload) => {
	const customer = await prisma.customer.findUnique({ where: { userId } });

	if (!customer) {
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");
	}

	const shipment = await prisma.shipment.findUnique({
		where: { id: payload.shipmentId },
		include: { payment: true },
	});

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (shipment.customerId !== customer.id) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have access to this shipment");
	}

	if (shipment.payment?.status === PaymentStatus.PAID) {
		throw new AppError(httpStatus.CONFLICT, "This shipment has already been paid for");
	}

	const headers = await bkashHeaders();

	const createResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/create`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			mode: "0011",
			payerReference: customer.contactNumber || customer.email,
			callbackURL: config.bkash_callback_url,
			amount: Number(shipment.deliveryFee).toFixed(2),
			currency: "BDT",
			intent: "sale",
			merchantInvoiceNumber: shipment.trackingCode,
		}),
	});

	const createResult = await createResponse.json();

	if (!createResponse.ok || !createResult.paymentID) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			createResult?.errorMessage || "Failed to initiate bKash payment",
		);
	}

	await prisma.payment.upsert({
		where: { shipmentId: shipment.id },
		create: {
			shipmentId: shipment.id,
			amount: shipment.deliveryFee,
			method: PaymentMethod.BKASH,
			status: PaymentStatus.UNPAID,
			merchantInvoiceNumber: shipment.trackingCode,
			bkashPaymentId: createResult.paymentID,
			payerReference: customer.contactNumber || customer.email,
			gatewayResponse: createResult,
		},
		update: {
			status: PaymentStatus.UNPAID,
			bkashPaymentId: createResult.paymentID,
			gatewayResponse: createResult,
		},
	});

	return {
		bkashURL: createResult.bkashURL,
		paymentID: createResult.paymentID,
	};
};

const handleCallback = async (paymentID: string, status: string) => {
	const payment = await prisma.payment.findUnique({ where: { bkashPaymentId: paymentID } });

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment record not found for this paymentID");
	}

	if (status !== "success") {
		const updatedPayment = await prisma.payment.update({
			where: { id: payment.id },
			data: { status: status === "cancel" ? PaymentStatus.CANCELLED : PaymentStatus.FAILED },
		});
		return updatedPayment;
	}

	const headers = await bkashHeaders();

	const executeResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/execute`, {
		method: "POST",
		headers,
		body: JSON.stringify({ paymentID }),
	});

	const executeResult = await executeResponse.json();

	if (!executeResponse.ok || executeResult.transactionStatus !== "Completed") {
		const updatedPayment = await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.FAILED, gatewayResponse: executeResult },
		});

		throw new AppError(
			httpStatus.BAD_GATEWAY,
			executeResult?.errorMessage || "bKash payment execution failed",
		);
	}

	const updatedPayment = await prisma.payment.update({
		where: { id: payment.id },
		data: {
			status: PaymentStatus.PAID,
			bkashTrxId: executeResult.trxID,
			paidAt: executeResult.paymentExecuteTime ?? new Date().toISOString(),
			gatewayResponse: executeResult,
		},
	});

	return updatedPayment;
};

const refundPayment = async (payload: IRefundPaymentPayload) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: payload.shipmentId },
		include: { payment: true },
	});

	if (!shipment || !shipment.payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found for this shipment");
	}

	const payment = shipment.payment;

	if (payment.status !== PaymentStatus.PAID || payment.method !== PaymentMethod.BKASH || !payment.bkashTrxId) {
		throw new AppError(httpStatus.BAD_REQUEST, "Only a completed bKash payment can be refunded");
	}

	const headers = await bkashHeaders();

	const refundResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/payment/refund`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			paymentID: payment.bkashPaymentId,
			trxID: payment.bkashTrxId,
			amount: Number(payment.amount).toFixed(2),
			sku: shipment.trackingCode,
			reason: payload.refundReason,
		}),
	});

	const refundResult = await refundResponse.json();

	if (!refundResponse.ok) {
		throw new AppError(httpStatus.BAD_GATEWAY, refundResult?.errorMessage || "bKash refund failed");
	}

	const updatedPayment = await prisma.payment.update({
		where: { id: payment.id },
		data: {
			status: PaymentStatus.REFUNDED,
			refundTrxId: refundResult.refundTrxID,
			refundAmount: payment.amount,
			refundReason: payload.refundReason,
			refundedAt: new Date().toISOString(),
			gatewayResponse: refundResult,
		},
	});

	return updatedPayment;
};

const getMyPayments = async (userId: string, query: IQuery) => {
	const customer = await prisma.customer.findUnique({ where: { userId } });

	if (!customer) {
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");
	}

	const { page, limit, skip, orderBy } = buildPagination(query);

	const where: Prisma.PaymentWhereInput = { shipment: { customerId: customer.id } };

	const [payments, total] = await prisma.$transaction([
		prisma.payment.findMany({
			where,
			skip,
			take: limit,
			orderBy,
			include: { shipment: { select: { id: true, trackingCode: true, status: true } } },
		}),
		prisma.payment.count({ where }),
	]);

	return { data: payments, meta: buildMeta(page, limit, total) };
};

const getAllPayments = async (query: IQuery) => {
	const { page, limit, skip, orderBy } = buildPagination(query);

	const andConditions: Prisma.PaymentWhereInput[] = [];

	if (query.status) {
		andConditions.push({ status: query.status as PaymentStatus });
	}

	const where: Prisma.PaymentWhereInput = andConditions.length ? { AND: andConditions } : {};

	const [payments, total] = await prisma.$transaction([
		prisma.payment.findMany({
			where,
			skip,
			take: limit,
			orderBy,
			include: {
				shipment: {
					select: { id: true, trackingCode: true, status: true, customer: { select: { name: true, email: true } } },
				},
			},
		}),
		prisma.payment.count({ where }),
	]);

	return { data: payments, meta: buildMeta(page, limit, total) };
};

const getPaymentByShipmentId = async (
	shipmentId: string,
	requestUser: { userId: string; role: Role },
) => {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		include: { customer: true, payment: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
	}

	if (requestUser.role === Role.CUSTOMER && shipment.customer.userId !== requestUser.userId) {
		throw new AppError(httpStatus.FORBIDDEN, "You do not have access to this shipment");
	}

	if (!shipment.payment) {
		throw new AppError(httpStatus.NOT_FOUND, "No payment has been initiated for this shipment yet");
	}

	return shipment.payment;
};

export const PaymentServices = {
	initiatePayment,
	handleCallback,
	refundPayment,
	getMyPayments,
	getAllPayments,
	getPaymentByShipmentId,
};
