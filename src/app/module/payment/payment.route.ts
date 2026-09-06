import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

// bKash redirects here — must stay public (no auth middleware)
router.get("/callback", PaymentController.handleCallback);

router.post(
	"/initiate",
	auth(Role.CUSTOMER),
	validateRequest(PaymentValidation.InitiatePaymentZodSchema),
	PaymentController.initiatePayment,
);

router.post(
	"/refund",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(PaymentValidation.RefundPaymentZodSchema),
	PaymentController.refundPayment,
);

router.get("/my-payments", auth(Role.CUSTOMER), PaymentController.getMyPayments);
router.get("/all-payments", auth(Role.SUPER_ADMIN, Role.ADMIN), PaymentController.getAllPayments);

router.get(
	"/:shipmentId",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.CUSTOMER),
	PaymentController.getPaymentByShipmentId,
);

export const PaymentRoutes = router;
