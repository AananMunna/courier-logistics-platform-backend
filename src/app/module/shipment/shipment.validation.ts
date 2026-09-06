import z from "zod";

const CreateShipmentZodSchema = z.object({
	parcelType: z.enum(["DOCUMENT", "PARCEL", "FRAGILE", "ELECTRONICS", "FOOD", "OTHER"]).optional(),
	parcelDescription: z.string().max(500).optional(),
	weightKg: z.number().positive("Weight must be greater than 0").max(1000),

	pickupAddress: z.string().min(5).max(255),
	pickupContactName: z.string().min(2).max(100),
	pickupContactPhone: z.string().min(6).max(20),

	deliveryAddress: z.string().min(5).max(255),
	deliveryContactName: z.string().min(2).max(100),
	deliveryContactPhone: z.string().min(6).max(20),

	distanceKm: z.number().positive().max(5000).optional(),

	isCod: z.boolean().optional(),
	codAmount: z.number().min(0).optional(),

	scheduledPickupAt: z.iso.datetime().optional(),

	originHubId: z.uuid("Invalid origin hub id"),
	destinationHubId: z.uuid("Invalid destination hub id"),
});

const AssignRiderZodSchema = z.object({
	riderId: z.uuid("Invalid rider id"),
	note: z.string().max(500).optional(),
});

const UpdateShipmentStatusZodSchema = z
	.object({
		status: z.enum(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED"]),
		note: z.string().max(500).optional(),
		failureReason: z.string().max(500).optional(),
	})
	.refine((data) => data.status !== "FAILED" || !!data.failureReason, {
		message: "failureReason is required when marking a shipment as FAILED",
		path: ["failureReason"],
	});

const CancelShipmentZodSchema = z.object({
	cancelReason: z.string().max(500).optional(),
});

export const ShipmentValidation = {
	CreateShipmentZodSchema,
	AssignRiderZodSchema,
	UpdateShipmentStatusZodSchema,
	CancelShipmentZodSchema,
};
