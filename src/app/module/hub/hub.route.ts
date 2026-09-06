import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { HubController } from "./hub.controller";
import { HubValidation } from "./hub.validation";

const router = Router();

router.post(
	"/",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(HubValidation.CreateHubZodSchema),
	HubController.createHub,
);
router.get("/", HubController.getAllHubs);
router.get("/:id", HubController.getSingleHub);
router.patch(
	"/:id",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(HubValidation.UpdateHubZodSchema),
	HubController.updateHub,
);
router.delete("/:id", auth(Role.SUPER_ADMIN, Role.ADMIN), HubController.deleteHub);

export const HubRoutes = router;
