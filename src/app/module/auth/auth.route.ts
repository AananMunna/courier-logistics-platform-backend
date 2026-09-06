import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	validateRequest(AuthValidation.CustomerRegistrationZodSchema),
	AuthController.registerCustomer,
);
router.post(
	"/verify-email",
	validateRequest(AuthValidation.EmailVerifyZodSchema),
	AuthController.verifyCustomerEmail,
);

router.post(
	"/register-rider",
	validateRequest(AuthValidation.RiderRegistrationZodSchema),
	AuthController.registerRider,
);
router.post(
	"/verify-rider-email",
	validateRequest(AuthValidation.EmailVerifyZodSchema),
	AuthController.verifyRiderEmail,
);

router.post("/login", validateRequest(AuthValidation.LoginZodSchema), AuthController.loginUser);
router.post("/logout", AuthController.logoutUser);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/google", validateRequest(AuthValidation.GoogleLoginZodSchema), AuthController.googleLogin);

router.get("/me", auth(Role.SUPER_ADMIN, Role.ADMIN, Role.RIDER, Role.CUSTOMER), AuthController.getMe);

router.post(
	"/change-password",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.RIDER, Role.CUSTOMER),
	validateRequest(AuthValidation.ChangePasswordZodSchema),
	AuthController.changePassword,
);

router.post(
	"/forgot-password",
	validateRequest(AuthValidation.ForgotPasswordZodSchema),
	AuthController.forgotPassword,
);
router.post(
	"/reset-password",
	validateRequest(AuthValidation.ResetPasswordZodSchema),
	AuthController.resetPassword,
);

export const AuthRoutes = router;
