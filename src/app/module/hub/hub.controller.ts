import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { HubServices } from "./hub.service";

const createHub = catchAsync(async (req: Request, res: Response) => {
	const result = await HubServices.createHub(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Hub created successfully",
		data: result,
	});
});

const getAllHubs = catchAsync(async (req: Request, res: Response) => {
	const result = await HubServices.getAllHubs(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hubs fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getSingleHub = catchAsync(async (req: Request, res: Response) => {
	const result = await HubServices.getSingleHub(req.params.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub fetched successfully",
		data: result,
	});
});

const updateHub = catchAsync(async (req: Request, res: Response) => {
	const result = await HubServices.updateHub(req.params.id, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub updated successfully",
		data: result,
	});
});

const deleteHub = catchAsync(async (req: Request, res: Response) => {
	const result = await HubServices.deleteHub(req.params.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hub deleted successfully",
		data: result,
	});
});

export const HubController = {
	createHub,
	getAllHubs,
	getSingleHub,
	updateHub,
	deleteHub,
};
