import z from "zod";

const VerifyRiderZodSchema = z
	.object({
		verificationStatus: z.enum(["APPROVED", "REJECTED"]),
		rejectionReason: z.string().max(500).optional(),
	})
	.refine((data) => data.verificationStatus !== "REJECTED" || !!data.rejectionReason, {
		message: "rejectionReason is required when rejecting a rider",
		path: ["rejectionReason"],
	});

const UpdateRiderProfileZodSchema = z.object({
	contactNumber: z.string().min(6).max(20).optional(),
	address: z.string().max(255).optional(),
	currentZone: z.string().max(100).optional(),
	isAvailable: z.boolean().optional(),
	vehicleType: z.enum(["BICYCLE", "MOTORCYCLE", "VAN", "TRUCK"]).optional(),
});

export const RiderValidation = {
	VerifyRiderZodSchema,
	UpdateRiderProfileZodSchema,
};
