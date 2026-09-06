import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";

const cookieOptions = {
	httpOnly: true,
	secure: config.node_env === "production",
	sameSite: (config.node_env === "production" ? "none" : "lax") as "none" | "lax",
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
	res.cookie("accessToken", accessToken, {
		...cookieOptions,
		maxAge: 1000 * 60 * 60 * 24,
	});
	res.cookie("refreshToken", refreshToken, {
		...cookieOptions,
		maxAge: 1000 * 60 * 60 * 24 * 30,
	});
};

const registerCustomer = catchAsync(async (req: Request, res: Response) => {
	await AuthService.registerCustomer(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Verification OTP sent to your email",
		data: null,
	});
});

const verifyCustomerEmail = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.verifyCustomerEmail(req.body);
	const { accessToken, refreshToken, user, customer } = result;

	setAuthCookies(res, accessToken, refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Email verified successfully",
		data: { accessToken, refreshToken, user, customer },
	});
});

const registerRider = catchAsync(async (req: Request, res: Response) => {
	await AuthService.registerRider(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Verification OTP sent to your email",
		data: null,
	});
});

const verifyRiderEmail = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.verifyRiderEmail(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: result.message,
		data: { user: result.user, rider: result.rider },
	});
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.loginUser(req.body);
	const { accessToken, refreshToken } = result;

	setAuthCookies(res, accessToken, refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged in successfully",
		data: { accessToken, refreshToken },
	});
});

const logoutUser = catchAsync(async (_req: Request, res: Response) => {
	res.clearCookie("accessToken", cookieOptions);
	res.clearCookie("refreshToken", cookieOptions);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged out successfully",
		data: null,
	});
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as unknown as IRequestUser;

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User information is missing in the request");
	}

	const result = await AuthService.getMe(user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile fetched successfully",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const token = req.cookies?.refreshToken ?? req.body?.refreshToken;

	if (!token) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
	}

	const result = await AuthService.refreshToken(token);
	const { accessToken, refreshToken: newRefreshToken } = result;

	setAuthCookies(res, accessToken, newRefreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully",
		data: { accessToken, refreshToken: newRefreshToken },
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.googleLogin(req.body);
	const { accessToken, refreshToken } = result;

	setAuthCookies(res, accessToken, refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged in with Google successfully",
		data: { accessToken, refreshToken },
	});
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	await AuthService.forgotPassword(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `OTP sent to email: ${req.body.email}`,
		data: null,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	await AuthService.resetPassword(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password changed successfully",
		data: null,
	});
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as unknown as IRequestUser;
	await AuthService.changePassword(user, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password changed successfully",
		data: null,
	});
});

export const AuthController = {
	registerCustomer,
	verifyCustomerEmail,
	registerRider,
	verifyRiderEmail,
	loginUser,
	logoutUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword,
	changePassword,
};
