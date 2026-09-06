import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AnalyticsRoutes } from "./app/module/analytics/analytics.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { HubRoutes } from "./app/module/hub/hub.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { RiderRoutes } from "./app/module/rider/rider.route";
import { ShipmentRoutes } from "./app/module/shipment/shipment.route";
import { TrackingRoutes } from "./app/module/tracking/tracking.route";
import { UserRoutes } from "./app/module/user/user.route";

const app: Application = express();

app.use(helmet());

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

app.use(
	rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: 300,
		standardHeaders: true,
		legacyHeaders: false,
		message: {
			success: false,
			message: "Too many requests from this IP. Please try again later.",
			errors: [],
		},
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/riders", RiderRoutes);
app.use("/api/v1/hubs", HubRoutes);
app.use("/api/v1/shipments", ShipmentRoutes);
app.use("/api/v1/tracking", TrackingRoutes);
app.use("/api/v1/payments", PaymentRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);

// Basic route
app.get("/", async (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to the Courier & Logistics Management Platform API",
		data: null,
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
