import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import path from "path";
import { AuthProvider, Role, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import type {
	IChangePasswordPayload,
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterCustomerPayload,
	IRegisterRiderPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifyEmailPayload,
} from "./auth.interface";

const OTP_TTL_SECONDS = 5 * 60;

const generateTokens = (user: { id: string; name: string; email: string; role: Role }) => {
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return { accessToken, refreshToken };
};

const sendTemplateEmail = async (
	to: string,
	subject: string,
	templateName: string,
	templateData: Record<string, unknown>,
) => {
	const templatePath = path.join(process.cwd(), `src/app/templates/${templateName}.ejs`);
	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to,
		subject,
		html,
	});
};

// ---------------- Customer Registration ----------------

const registerCustomer = async (payload: IRegisterCustomerPayload) => {
	const { name, password, customer: customerData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({ where: { email } });

	if (isUserExists) {
		throw new AppError(httpStatus.CONFLICT, "User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds) || 10);

	const otpKey = `customer-registration-otp:${email}`;
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpKey, otpValue, {
		expiration: { type: "EX", value: OTP_TTL_SECONDS },
	});

	const registrationDataKey = `customer-registration-data:${email}`;
	const redisUserDataPayload = {
		name,
		email,
		password: hashedPassword,
		customer: customerData,
	};

	await redisClient.set(registrationDataKey, JSON.stringify(redisUserDataPayload), {
		expiration: { type: "EX", value: OTP_TTL_SECONDS },
	});

	await sendTemplateEmail(email, "Verify Your Email", "registration-user-otp", {
		name,
		email,
		otp: otpValue,
		expirationMinutes: OTP_TTL_SECONDS / 60,
	});
};

const verifyCustomerEmail = async (payload: IVerifyEmailPayload) => {
	const { otp } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExist = await prisma.user.findUnique({ where: { email } });

	if (isUserExist?.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (isUserExist?.emailVerified) {
		throw new AppError(httpStatus.CONFLICT, "Email already verified");
	}

	if (isUserExist?.isDeleted || isUserExist?.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
	}

	const otpKey = `customer-registration-otp:${email}`;
	const redisOtp = await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP expired or invalid. Please register again.");
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
	}

	await redisClient.del(otpKey);

	const registrationDataKey = `customer-registration-data:${email}`;
	const redisCustomerData = await redisClient.get(registrationDataKey);

	if (!redisCustomerData) {
		throw new AppError(httpStatus.BAD_REQUEST, "Registration session expired. Please register again.");
	}

	const customerPayload: IRegisterCustomerPayload & { password: string } = JSON.parse(redisCustomerData);

	const createdUser = await prisma.user.create({
		data: {
			name: customerPayload.name,
			email: customerPayload.email,
			password: customerPayload.password,
			role: Role.CUSTOMER,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			customer: {
				create: {
					name: customerPayload.name,
					email: customerPayload.email,
					contactNumber: customerPayload.customer?.contactNumber,
					address: customerPayload.customer?.address,
				},
			},
		},
		omit: { password: true },
		include: { customer: true },
	});

	await redisClient.del(registrationDataKey);

	await sendTemplateEmail(email, "Welcome To Our Courier Platform", "customer-welcome-email", {
		name: createdUser.name,
	});

	const { customer, ...user } = createdUser;
	const { accessToken, refreshToken } = generateTokens(user);

	return { user, customer, accessToken, refreshToken };
};

// ---------------- Rider Registration (application, needs admin approval) ----------------

const registerRider = async (payload: IRegisterRiderPayload) => {
	const { name, password, rider: riderData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({ where: { email } });

	if (isUserExists) {
		throw new AppError(httpStatus.CONFLICT, "User with this email already exists");
	}

	const [existingVehicle, existingNid] = await Promise.all([
		prisma.rider.findUnique({ where: { vehicleRegistrationNumber: riderData.vehicleRegistrationNumber } }),
		prisma.rider.findUnique({ where: { nidNumber: riderData.nidNumber } }),
	]);

	if (existingVehicle) {
		throw new AppError(httpStatus.CONFLICT, "This vehicle registration number is already in use");
	}

	if (existingNid) {
		throw new AppError(httpStatus.CONFLICT, "This NID number is already in use");
	}

	const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds) || 10);

	const otpKey = `rider-registration-otp:${email}`;
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpKey, otpValue, {
		expiration: { type: "EX", value: OTP_TTL_SECONDS },
	});

	const registrationDataKey = `rider-registration-data:${email}`;
	const redisUserDataPayload = {
		name,
		email,
		password: hashedPassword,
		rider: riderData,
	};

	await redisClient.set(registrationDataKey, JSON.stringify(redisUserDataPayload), {
		expiration: { type: "EX", value: OTP_TTL_SECONDS },
	});

	await sendTemplateEmail(email, "Verify Your Email", "registration-user-otp", {
		name,
		email,
		otp: otpValue,
		expirationMinutes: OTP_TTL_SECONDS / 60,
	});
};

const verifyRiderEmail = async (payload: IVerifyEmailPayload) => {
	const { otp } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExist = await prisma.user.findUnique({ where: { email } });

	if (isUserExist?.emailVerified) {
		throw new AppError(httpStatus.CONFLICT, "Email already verified");
	}

	const otpKey = `rider-registration-otp:${email}`;
	const redisOtp = await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP expired or invalid. Please register again.");
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
	}

	await redisClient.del(otpKey);

	const registrationDataKey = `rider-registration-data:${email}`;
	const redisRiderData = await redisClient.get(registrationDataKey);

	if (!redisRiderData) {
		throw new AppError(httpStatus.BAD_REQUEST, "Registration session expired. Please register again.");
	}

	const riderPayload: IRegisterRiderPayload & { password: string } = JSON.parse(redisRiderData);

	const createdUser = await prisma.user.create({
		data: {
			name: riderPayload.name,
			email: riderPayload.email,
			password: riderPayload.password,
			role: Role.RIDER,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			rider: {
				create: {
					name: riderPayload.name,
					email: riderPayload.email,
					vehicleType: riderPayload.rider.vehicleType,
					vehicleRegistrationNumber: riderPayload.rider.vehicleRegistrationNumber,
					nidNumber: riderPayload.rider.nidNumber,
					drivingLicenseNumber: riderPayload.rider.drivingLicenseNumber,
					contactNumber: riderPayload.rider.contactNumber,
					currentZone: riderPayload.rider.currentZone,
				},
			},
		},
		omit: { password: true },
		include: { rider: true },
	});

	await redisClient.del(registrationDataKey);

	const { rider, ...user } = createdUser;

	return {
		user,
		rider,
		message:
			"Email verified successfully. Your rider application is now pending admin review. You will be notified by email once reviewed.",
	};
};

// ---------------- Login / Session ----------------

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({ where: { email } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
	}

	if (!user.emailVerified) {
		throw new AppError(httpStatus.FORBIDDEN, "Please verify your email before logging in");
	}

	if (user.password === null && user.googleId !== null) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account is registered with Google. Please login with Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(password, user.password as string);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	if (user.role === Role.RIDER) {
		const rider = await prisma.rider.findUnique({ where: { userId: user.id } });
		if (rider?.verificationStatus === "REJECTED") {
			throw new AppError(httpStatus.FORBIDDEN, "Your rider application has been rejected");
		}
	}

	const { accessToken, refreshToken } = generateTokens(user);

	return { accessToken, refreshToken };
};

const getMe = async (requestUser: IRequestUser) => {
	const user = await prisma.user.findUnique({
		where: { id: requestUser.userId },
		include: { customer: true, rider: true },
		omit: { password: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return user;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(token, config.jwt_refresh_secret);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development" ? verifiedRefreshToken.error : "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({ where: { id: data.userId } });

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new AppError(httpStatus.UNAUTHORIZED, "User is inactive or not found");
	}

	const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

	return { accessToken, refreshToken: newRefreshToken };
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		console.log("Google ID Token Verification Failed", error);
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired Google ID token");
	}

	if (!googleIdTokenPayload?.email || !googleIdTokenPayload?.name) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google account email or name not found");
	}

	let user = await prisma.user.findUnique({
		where: {
			email: googleIdTokenPayload.email,
			role: Role.CUSTOMER,
			googleId: googleIdTokenPayload.sub,
		},
	});

	if (!user) {
		const existingCredentialUser = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
				role: Role.CUSTOMER,
				authProvider: AuthProvider.CREDENTIAL,
			},
		});

		if (existingCredentialUser) {
			if (existingCredentialUser.status === UserStatus.BLOCKED) {
				throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
			}

			if (existingCredentialUser.isDeleted || existingCredentialUser.status === UserStatus.DELETED) {
				throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
			}

			user = await prisma.user.update({
				where: { id: existingCredentialUser.id },
				data: { googleId: googleIdTokenPayload.sub },
			});
		} else {
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email: googleIdTokenPayload.email,
					role: Role.CUSTOMER,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
					customer: {
						create: {
							name: googleIdTokenPayload.name,
							email: googleIdTokenPayload.email,
						},
					},
				},
			});

			await sendTemplateEmail(user.email, "Welcome To Our Courier Platform", "customer-welcome-email", {
				name: user.name,
			});
		}
	}

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
	}

	const { accessToken, refreshToken } = generateTokens(user);

	return { accessToken, refreshToken };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const email = payload.email.trim().toLowerCase();

	const isUserExist = await prisma.user.findUnique({ where: { email } });

	if (!isUserExist) {
		throw new AppError(httpStatus.NOT_FOUND, "User does not exist");
	}

	if (isUserExist.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (!isUserExist.emailVerified) {
		throw new AppError(httpStatus.FORBIDDEN, "User is not verified");
	}

	if (isUserExist.isDeleted || isUserExist.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
	}

	if (isUserExist.googleId && isUserExist.authProvider === AuthProvider.GOOGLE) {
		throw new AppError(httpStatus.BAD_REQUEST, "This account uses Google login");
	}

	const otp = crypto.randomInt(100000, 1000000).toString();
	const key = `forgot-password-otp:${isUserExist.email}`;

	await redisClient.set(key, otp, {
		expiration: { type: "EX", value: OTP_TTL_SECONDS },
	});

	await sendTemplateEmail(isUserExist.email, "Forgot Password", "forgot-password", {
		name: isUserExist.name,
		otp,
		expirationMinutes: OTP_TTL_SECONDS / 60,
	});
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const { otp, newPassword } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExist = await prisma.user.findUnique({ where: { email } });

	if (!isUserExist) {
		throw new AppError(httpStatus.NOT_FOUND, "User does not exist");
	}

	if (isUserExist.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (isUserExist.isDeleted || isUserExist.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
	}

	const key = `forgot-password-otp:${isUserExist.email}`;
	const redisOtp = await redisClient.get(key);

	if (!redisOtp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP expired or invalid");
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
	}

	const hashedNewPassword = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds) || 10);

	await prisma.user.update({
		where: { email: isUserExist.email },
		data: { password: hashedNewPassword },
	});

	await redisClient.del(key);

	await sendTemplateEmail(isUserExist.email, "Password Changed", "reset-password-success", {
		name: isUserExist.name,
	});
};

const changePassword = async (requestUser: IRequestUser, payload: IChangePasswordPayload) => {
	const user = await prisma.user.findUnique({ where: { id: requestUser.userId } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (!user.password) {
		throw new AppError(httpStatus.BAD_REQUEST, "This account uses Google login and has no password set");
	}

	const isOldPasswordMatched = await bcrypt.compare(payload.oldPassword, user.password);

	if (!isOldPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
	}

	const hashedNewPassword = await bcrypt.hash(payload.newPassword, Number(config.bcrypt_salt_rounds) || 10);

	await prisma.user.update({
		where: { id: user.id },
		data: { password: hashedNewPassword, needPasswordChange: false },
	});
};

export const AuthService = {
	registerCustomer,
	verifyCustomerEmail,
	registerRider,
	verifyRiderEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgotPassword,
	resetPassword,
	changePassword,
};
