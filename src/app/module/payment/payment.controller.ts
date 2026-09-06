import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentServices } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await PaymentServices.initiatePayment(userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "bKash payment session created successfully",
		data: result,
	});
});

const handleCallback = catchAsync(async (req: Request, res: Response) => {
	const { paymentID, status } = req.query as { paymentID: string; status: string };

	if (!paymentID || !status) {
		return res.redirect(`${config.frontend_url}/payment/failure?reason=missing_params`);
	}

	try {
		const payment = await PaymentServices.handleCallback(paymentID, status);
		return res.redirect(
			`${config.frontend_url}/payment/${payment.status === "PAID" ? "success" : "failure"}?paymentID=${paymentID}`,
		);
	} catch (error) {
		return res.redirect(`${config.frontend_url}/payment/failure?paymentID=${paymentID}`);
	}
});

const refundPayment = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentServices.refundPayment(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment refunded successfully",
		data: result,
	});
});

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await PaymentServices.getMyPayments(userId, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payments fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentServices.getAllPayments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payments fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getPaymentByShipmentId = catchAsync(async (req: Request, res: Response) => {
	const requestUser = req.user as { userId: string; role: import("../../../generated/prisma/enums").Role };
	const result = await PaymentServices.getPaymentByShipmentId(req.params.shipmentId, requestUser);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment fetched successfully",
		data: result,
	});
});

export const PaymentController = {
	initiatePayment,
	handleCallback,
	refundPayment,
	getMyPayments,
	getAllPayments,
	getPaymentByShipmentId,
};
