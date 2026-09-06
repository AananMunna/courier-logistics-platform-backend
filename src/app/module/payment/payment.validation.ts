import z from "zod";

const InitiatePaymentZodSchema = z.object({
	shipmentId: z.uuid("Invalid shipment id"),
});

const RefundPaymentZodSchema = z.object({
	shipmentId: z.uuid("Invalid shipment id"),
	refundReason: z.string().min(3).max(500),
});

export const PaymentValidation = {
	InitiatePaymentZodSchema,
	RefundPaymentZodSchema,
};
