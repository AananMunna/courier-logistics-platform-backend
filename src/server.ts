import app from "./app";
import config from "./app/config";
import { deleteUnverifiedRiders } from "./app/lib/cron";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import {
	seedHubs,
	seedSuperAdmin,
	seedTesterAdmin,
	seedTesterCustomer,
	seedTesterRider,
} from "./app/utils/seed";

const PORT = config.port || 5000;

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");

		await redisClient.connect();
		console.log("Redis Connected Successfully.");

		try {
			await transporter.verify();
			console.log("Nodemailer Connected Successfully.");
		} catch (error) {
			console.log("Warning: Nodemailer connection could not be verified.", error);
		}

		await seedSuperAdmin();
		await seedTesterAdmin();
		await seedTesterRider();
		await seedTesterCustomer();
		await seedHubs();

		await deleteUnverifiedRiders();

		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();
