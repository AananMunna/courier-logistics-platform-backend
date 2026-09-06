import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ShipmentServices } from "./shipment.service";

const createShipment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await ShipmentServices.createShipment(userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Shipment created successfully",
		data: result,
	});
});

const getAllShipments = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentServices.getAllShipments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipments fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getMyShipments = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await ShipmentServices.getMyShipments(userId, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Your shipments fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getShipmentById = catchAsync(async (req: Request, res: Response) => {
	const requestUser = req.user as { userId: string; role: import("../../../generated/prisma/enums").Role };
	const result = await ShipmentServices.getShipmentById(req.params.id, requestUser);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment fetched successfully",
		data: result,
	});
});

const trackShipmentByCode = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentServices.trackShipmentByCode(req.params.trackingCode);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Tracking information fetched successfully",
		data: result,
	});
});

const assignRider = catchAsync(async (req: Request, res: Response) => {
	const adminUserId = req.user?.userId as string;
	const result = await ShipmentServices.assignRider(req.params.id, adminUserId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Rider assigned successfully",
		data: result,
	});
});

const updateShipmentStatus = catchAsync(async (req: Request, res: Response) => {
	const requestUser = req.user as {
		userId: string;
		name: string;
		role: import("../../../generated/prisma/enums").Role;
	};
	const result = await ShipmentServices.updateShipmentStatus(req.params.id, requestUser, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `Shipment status updated to ${result.status}`,
		data: result,
	});
});

const cancelShipment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await ShipmentServices.cancelShipment(req.params.id, userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment cancelled successfully",
		data: result,
	});
});

const deleteShipment = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentServices.deleteShipment(req.params.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Shipment deleted successfully",
		data: result,
	});
});

export const ShipmentController = {
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
