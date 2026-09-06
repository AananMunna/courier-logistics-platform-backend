import z from "zod";

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters long.")
	.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
	.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
	.regex(/[0-9]/, "Password must contain at least 1 number")
	.regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character");

const CustomerRegistrationZodSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters long").max(100),
	email: z.email("Invalid email address"),
	password: passwordSchema,
	customer: z
		.object({
			contactNumber: z.string().min(6).max(20).optional(),
			address: z.string().max(255).optional(),
		})
		.optional(),
});

const RiderRegistrationZodSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters long").max(100),
	email: z.email("Invalid email address"),
	password: passwordSchema,
	rider: z.object({
		vehicleType: z.enum(["BICYCLE", "MOTORCYCLE", "VAN", "TRUCK"]),
		vehicleRegistrationNumber: z.string().min(2).max(50),
		nidNumber: z.string().min(5).max(30),
		drivingLicenseNumber: z.string().max(50).optional(),
		contactNumber: z.string().min(6).max(20).optional(),
		currentZone: z.string().max(100).optional(),
	}),
});

const EmailVerifyZodSchema = z.object({
	email: z.email("Invalid email address"),
	otp: z.string().length(6),
});

const LoginZodSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

const ForgotPasswordZodSchema = z.object({
	email: z.email("Invalid email address"),
});

const ResetPasswordZodSchema = z.object({
	email: z.email("Invalid email address"),
	newPassword: passwordSchema,
	otp: z.string().length(6),
});

const ChangePasswordZodSchema = z.object({
	oldPassword: z.string().min(1, "Old password is required"),
	newPassword: passwordSchema,
});

const GoogleLoginZodSchema = z.object({
	idToken: z.string().min(10, "Invalid Google ID token"),
});

export const AuthValidation = {
	CustomerRegistrationZodSchema,
	RiderRegistrationZodSchema,
	EmailVerifyZodSchema,
	LoginZodSchema,
	ForgotPasswordZodSchema,
	ResetPasswordZodSchema,
	ChangePasswordZodSchema,
	GoogleLoginZodSchema,
};
