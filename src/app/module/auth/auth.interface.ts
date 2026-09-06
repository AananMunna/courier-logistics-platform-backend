import type { Role } from "../../../generated/prisma/enums";

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRegisterCustomerPayload {
	name: string;
	email: string;
	password: string;
	customer?: {
		contactNumber?: string;
		address?: string;
	};
}

export interface IRegisterRiderPayload {
	name: string;
	email: string;
	password: string;
	rider: {
		vehicleType: "BICYCLE" | "MOTORCYCLE" | "VAN" | "TRUCK";
		vehicleRegistrationNumber: string;
		nidNumber: string;
		drivingLicenseNumber?: string;
		contactNumber?: string;
		currentZone?: string;
	};
}

export interface IVerifyEmailPayload {
	email: string;
	otp: string;
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}

export interface IGoogleLoginPayload {
	idToken: string;
}

export interface IForgotPasswordPayload {
	email: string;
}
export interface IResetPasswordPayload {
	email: string;
	newPassword: string;
	otp: string;
}

export interface IChangePasswordPayload {
	oldPassword: string;
	newPassword: string;
}
