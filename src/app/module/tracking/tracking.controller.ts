import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TrackingServices } from "./tracking.service";

const getTimeline = catchAsync(async (req: Request, res: Response) => {
	const requestUser = req.user as { userId: string; role: import("../../../generated/prisma/enums").Role };
	const result = await TrackingServices.getTimeline(req.params.shipmentId, requestUser);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Tracking timeline fetched successfully",
		data: result,
	});
});

const addNote = catchAsync(async (req: Request, res: Response) => {
	const requestUser = req.user as {
		userId: string;
		name: string;
		role: import("../../../generated/prisma/enums").Role;
	};
	const result = await TrackingServices.addNote(req.params.shipmentId, requestUser, req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Tracking note added successfully",
		data: result,
	});
});

export const TrackingController = {
	getTimeline,
	addNote,
};
