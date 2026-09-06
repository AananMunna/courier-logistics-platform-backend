import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TrackingController } from "./tracking.controller";
import { TrackingValidation } from "./tracking.validation";

const router = Router();

router.get(
	"/:shipmentId",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.RIDER, Role.CUSTOMER),
	TrackingController.getTimeline,
);

router.post(
	"/:shipmentId/note",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.RIDER),
	validateRequest(TrackingValidation.AddTrackingNoteZodSchema),
	TrackingController.addNote,
);

export const TrackingRoutes = router;
