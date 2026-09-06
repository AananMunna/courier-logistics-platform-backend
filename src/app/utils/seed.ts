import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import { RiderVerificationStatus, Role, VehicleType } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "./AppError";

export const seedSuperAdmin = async () => {
	try {
		const isSuperAdminExist = await prisma.user.findFirst({
			where: { role: Role.SUPER_ADMIN },
		});

		if (isSuperAdminExist) {
			console.log("Super Admin Already Exists!");
			return;
		}

		const name = config.super_admin_name;
		const email = config.super_admin_email;
		const password = config.super_admin_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Super Admin Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

		const superAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.SUPER_ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});

		console.log("Super Admin Created : ", superAdmin.email);
	} catch (error) {
		console.log("Error Seeding Super Admin : ", error);
	}
};

export const seedTesterAdmin = async () => {
	try {
		const isTesterAdminExist = await prisma.user.findUnique({
			where: { email: config.tester_admin_email },
		});

		if (isTesterAdminExist) {
			console.log("Tester Admin Already Exists!");
			return;
		}

		const name = config.tester_admin_name;
		const email = config.tester_admin_email;
		const password = config.tester_admin_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester Admin Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

		const testerAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});

		console.log("Tester Admin Created : ", testerAdmin.email);
	} catch (error) {
		console.log("Error Seeding Tester Admin : ", error);
	}
};

export const seedTesterRider = async () => {
	try {
		const isTesterRiderExist = await prisma.user.findUnique({
			where: { email: config.tester_rider_email },
		});

		if (isTesterRiderExist) {
			console.log("Tester Rider Already Exists!");
			return;
		}

		const name = config.tester_rider_name;
		const email = config.tester_rider_email;
		const password = config.tester_rider_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester Rider Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

		const testerRider = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.RIDER,
				needPasswordChange: false,
				emailVerified: true,
				rider: {
					create: {
						name,
						email,
						vehicleType: VehicleType.MOTORCYCLE,
						vehicleRegistrationNumber: "DHK-TEST-0000",
						nidNumber: "0000000000000",
						currentZone: "Dhaka",
						verificationStatus: RiderVerificationStatus.APPROVED,
					},
				},
			},
		});

		console.log("Tester Rider Created : ", testerRider.email);
	} catch (error) {
		console.log("Error Seeding Tester Rider : ", error);
	}
};

export const seedTesterCustomer = async () => {
	try {
		const isTesterCustomerExist = await prisma.user.findUnique({
			where: { email: config.tester_customer_email },
		});

		if (isTesterCustomerExist) {
			console.log("Tester Customer Already Exists!");
			return;
		}

		const name = config.tester_customer_name;
		const email = config.tester_customer_email;
		const password = config.tester_customer_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester Customer Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

		const testerCustomer = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.CUSTOMER,
				needPasswordChange: false,
				emailVerified: true,
				customer: {
					create: {
						name,
						email,
					},
				},
			},
		});

		console.log("Tester Customer Created : ", testerCustomer.email);
	} catch (error) {
		console.log("Error Seeding Tester Customer : ", error);
	}
};

export const seedHubs = async () => {
	try {
		const hubCount = await prisma.hub.count();
		if (hubCount > 0) {
			console.log("Hubs Already Seeded!");
			return;
		}

		await prisma.hub.createMany({
			data: [
				{ name: "Dhaka Central Hub", zone: "Dhaka", address: "Motijheel, Dhaka" },
				{ name: "Gulshan Hub", zone: "Dhaka", address: "Gulshan-1, Dhaka" },
				{ name: "Chattogram Hub", zone: "Chattogram", address: "Agrabad, Chattogram" },
				{ name: "Khulna Hub", zone: "Khulna", address: "Sonadanga, Khulna" },
				{ name: "Sylhet Hub", zone: "Sylhet", address: "Zindabazar, Sylhet" },
			],
		});

		console.log("Hubs Seeded Successfully!");
	} catch (error) {
		console.log("Error Seeding Hubs : ", error);
	}
};
