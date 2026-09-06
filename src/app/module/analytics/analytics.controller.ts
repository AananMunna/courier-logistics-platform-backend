import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { RequestUser } from "../../middleware/checkAuth";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnalyticsServices } from "./analytics.service";

const getAdminAnalytics = catchAsync(async (_req: Request, res: Response) => {
	const result = await AnalyticsServices.getAdminAnalytics();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Admin dashboard stats fetched successfully",
		data: result,
	});
});

const getCustomerAnalytics = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const result = await AnalyticsServices.getCustomerAnalytics(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Customer analytics fetched successfully",
		data: result,
	});
});

const getRiderAnalytics = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as RequestUser;
	const result = await AnalyticsServices.getRiderAnalytics(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Rider analytics fetched successfully",
		data: result,
	});
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
	const result = await AnalyticsServices.getAuditLogs(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit logs fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const AnalyticsController = {
	getAdminAnalytics,
	getCustomerAnalytics,
	getRiderAnalytics,
	getAuditLogs,
};
