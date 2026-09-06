import z from "zod";

const CreateHubZodSchema = z.object({
	name: z.string().min(2).max(100),
	zone: z.string().min(2).max(100),
	address: z.string().min(5).max(255),
	contactNumber: z.string().min(6).max(20).optional(),
});

const UpdateHubZodSchema = z.object({
	name: z.string().min(2).max(100).optional(),
	zone: z.string().min(2).max(100).optional(),
	address: z.string().min(5).max(255).optional(),
	contactNumber: z.string().min(6).max(20).optional(),
	isActive: z.boolean().optional(),
});

export const HubValidation = {
	CreateHubZodSchema,
	UpdateHubZodSchema,
};
