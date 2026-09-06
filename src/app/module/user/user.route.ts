import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

router.patch(
	"/profile-image",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.RIDER, Role.CUSTOMER),
	upload.single("profileImage"),
	UserController.uploadProfileImage,
);

router.patch(
	"/me",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.RIDER, Role.CUSTOMER),
	validateRequest(UserValidation.UpdateMeZodSchema),
	UserController.updateMe,
);

router.get("/", auth(Role.SUPER_ADMIN, Role.ADMIN), UserController.getAllUsers);
router.get("/:id", auth(Role.SUPER_ADMIN, Role.ADMIN), UserController.getSingleUser);
router.patch(
	"/:id/status",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	validateRequest(UserValidation.UpdateUserStatusZodSchema),
	UserController.updateUserStatus,
);

export const UserRoutes = router;
