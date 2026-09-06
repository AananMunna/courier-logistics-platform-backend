import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

router.get("/dashboard-stats", auth(Role.SUPER_ADMIN, Role.ADMIN), AnalyticsController.getAdminAnalytics);
router.get("/audit-logs", auth(Role.SUPER_ADMIN, Role.ADMIN), AnalyticsController.getAuditLogs);
router.get("/customer-analytics", auth(Role.CUSTOMER), AnalyticsController.getCustomerAnalytics);
router.get("/rider-analytics", auth(Role.RIDER), AnalyticsController.getRiderAnalytics);

export const AnalyticsRoutes = router;
