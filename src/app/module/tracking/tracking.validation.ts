import z from "zod";

const AddTrackingNoteZodSchema = z.object({
	note: z.string().min(2).max(500),
});

export const TrackingValidation = {
	AddTrackingNoteZodSchema,
};
