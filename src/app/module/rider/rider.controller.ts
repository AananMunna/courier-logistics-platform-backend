import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { RiderServices } from "./rider.service";

const getAllRiders = catchAsync(async (req: Request, res: Response) => {
	const result = await RiderServices.getAllRiders(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Riders fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getSingleRider = catchAsync(async (req: Request, res: Response) => {
	const result = await RiderServices.getSingleRider(req.params.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Rider fetched successfully",
		data: result,
	});
});

const verifyRider = catchAsync(async (req: Request, res: Response) => {
	const reviewerName = req.user?.name as string;
	const result = await RiderServices.verifyRider(req.params.id, reviewerName, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `Rider application ${result.verificationStatus.toLowerCase()} successfully`,
		data: result,
	});
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await RiderServices.getMyProfile(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Rider profile fetched successfully",
		data: result,
	});
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await RiderServices.updateMyProfile(userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Rider profile updated successfully",
		data: result,
	});
});

const getMyAssignedShipments = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await RiderServices.getMyAssignedShipments(userId, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Assigned shipments fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getMyEarnings = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await RiderServices.getMyEarnings(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Earnings fetched successfully",
		data: result,
	});
});

export const RiderController = {
	getAllRiders,
	getSingleRider,
	verifyRider,
	getMyProfile,
	updateMyProfile,
	getMyAssignedShipments,
	getMyEarnings,
};
