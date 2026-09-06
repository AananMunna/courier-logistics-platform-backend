import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ShipmentController } from "./shipment.controller";
import { ShipmentValidation } from "./shipment.validation";

const router = Router();

// Public tracking (no auth) — must be registered before "/:id"
router.get("/track/:trackingCode", ShipmentController.trackShipmentByCode);

router.post(
	"/",
	auth(Role.CUSTOMER),
	validateRequest(ShipmentValidation.CreateShipmentZodSchema),
	ShipmentController.createShipment,
);

router.get("/my-shipments", auth(Role.CUSTOMER), ShipmentController.getMyShipments);

router.get("/", auth(Role.SUPER_ADMIN, Role.ADMIN), ShipmentController.getAllShipments);

router.get(
	"/:id",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.RIDER, Role.CUSTOMER),
	ShipmentController.getShipmentById,
);

router.patch(
	"/:id/assign",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(ShipmentValidation.AssignRiderZodSchema),
	ShipmentController.assignRider,
);

router.patch(
	"/:id/status",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.RIDER),
	validateRequest(ShipmentValidation.UpdateShipmentStatusZodSchema),
	ShipmentController.updateShipmentStatus,
);

router.patch(
	"/:id/cancel",
	auth(Role.CUSTOMER),
	validateRequest(ShipmentValidation.CancelShipmentZodSchema),
	ShipmentController.cancelShipment,
);

router.delete("/:id", auth(Role.SUPER_ADMIN, Role.ADMIN), ShipmentController.deleteShipment);

export const ShipmentRoutes = router;
