import z from "zod";

const UpdateMeZodSchema = z.object({
	name: z.string().min(2).max(100).optional(),
	customer: z
		.object({
			contactNumber: z.string().min(6).max(20).optional(),
			address: z.string().max(255).optional(),
		})
		.optional(),
});

const UpdateUserStatusZodSchema = z.object({
	status: z.enum(["ACTIVE", "BLOCKED"]),
});

export const UserValidation = {
	UpdateMeZodSchema,
	UpdateUserStatusZodSchema,
};
