import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RiderController } from "./rider.controller";
import { RiderValidation } from "./rider.validation";

const router = Router();

router.get(
	"/me/assigned-shipments",
	auth(Role.RIDER),
	RiderController.getMyAssignedShipments,
);
router.get("/me/earnings", auth(Role.RIDER), RiderController.getMyEarnings);
router.get("/me", auth(Role.RIDER), RiderController.getMyProfile);
router.patch(
	"/me",
	auth(Role.RIDER),
	validateRequest(RiderValidation.UpdateRiderProfileZodSchema),
	RiderController.updateMyProfile,
);

router.get("/", auth(Role.SUPER_ADMIN, Role.ADMIN), RiderController.getAllRiders);
router.get("/:id", auth(Role.SUPER_ADMIN, Role.ADMIN), RiderController.getSingleRider);
router.patch(
	"/:id/verify",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(RiderValidation.VerifyRiderZodSchema),
	RiderController.verifyRider,
);

export const RiderRoutes = router;
