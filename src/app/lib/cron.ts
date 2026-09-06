import cron from "node-cron";
import { RiderVerificationStatus, Role } from "../../generated/prisma/enums";
import { prisma } from "./prisma";

export const deleteUnverifiedRiders = async () => {
	cron.schedule("*/10 * * * *", async () => {
		try {
			const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
			const deletedRiders = await prisma.user.deleteMany({
				where: {
					role: Role.RIDER,
					emailVerified: false,
					createdAt: { lt: oneHourAgo },
					rider: {
						verificationStatus: RiderVerificationStatus.PENDING,
					},
				},
			});

			if (deletedRiders.count > 0) {
				console.log(
					`Cron: Deleted ${deletedRiders.count} unverified email rider applications older than 1 hour`,
				);
			}
		} catch (error) {
			console.log("Cron: Failed to delete unverified rider applications", error);
		}

		console.log("Unverified Rider Delete cron schedule (every 10 minutes)");
	});
};
