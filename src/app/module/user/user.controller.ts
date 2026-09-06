import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserServices } from "./user.service";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
	if (!req.file) {
		throw new AppError(httpStatus.BAD_REQUEST, "No file provided");
	}

	const userId = req.user?.userId as string;
	const result = await UserServices.uploadProfileImage(req.file.buffer, userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile image uploaded successfully",
		data: result,
	});
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await UserServices.updateMe(userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile updated successfully",
		data: result,
	});
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	const result = await UserServices.getAllUsers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getSingleUser = catchAsync(async (req: Request, res: Response) => {
	const result = await UserServices.getSingleUser(req.params.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User fetched successfully",
		data: result,
	});
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await UserServices.updateUserStatus(req.params.id, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User status updated successfully",
		data: result,
	});
});

export const UserController = {
	uploadProfileImage,
	updateMe,
	getAllUsers,
	getSingleUser,
	updateUserStatus,
};
