import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import type { Role, UserStatus } from "../../../generated/prisma/enums";
import type { IQuery } from "../../interfaces";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, buildPagination } from "../../utils/queryHelper";
import type { IUpdateMePayload, IUpdateUserStatusPayload } from "./user.interface";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
	const currentUser = await prisma.user.findUnique({
		where: { id: userId },
		select: { imagePublicId: true, imageUrl: true },
	});

	const cloudinaryResult = await new Promise<UploadApiResponse>((resolve, reject) => {
		cloudinary.uploader
			.upload_stream({ resource_type: "auto", folder: "courier/profile" }, async (error, result) => {
				if (error) {
					return reject(error);
				}
				if (!result) {
					return reject(new Error("No result returned from Cloudinary"));
				}
				resolve(result);
			})
			.end(buffer);
	});

	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: {
			imageUrl: cloudinaryResult.secure_url,
			imagePublicId: cloudinaryResult.public_id,
		},
		omit: { password: true },
	});

	if (currentUser?.imagePublicId && currentUser.imageUrl) {
		await cloudinary.uploader.destroy(currentUser.imagePublicId);
	}

	return updatedUser;
};

const updateMe = async (userId: string, payload: IUpdateMePayload) => {
	const user = await prisma.user.findUnique({ where: { id: userId } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const updatedUser = await prisma.$transaction(async (tx) => {
		const updated = await tx.user.update({
			where: { id: userId },
			data: { name: payload.name },
			omit: { password: true },
		});

		if (payload.customer && user.role === "CUSTOMER") {
			await tx.customer.update({
				where: { userId },
				data: {
					name: payload.name,
					contactNumber: payload.customer.contactNumber,
					address: payload.customer.address,
				},
			});
		}

		return updated;
	});

	return updatedUser;
};

const getAllUsers = async (query: IQuery) => {
	const { page, limit, skip, orderBy } = buildPagination(query);

	const andConditions: Prisma.UserWhereInput[] = [];

	if (query.role) {
		andConditions.push({ role: query.role as Role });
	}

	if (query.status) {
		andConditions.push({ status: query.status as UserStatus });
	}

	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ name: { contains: query.searchTerm, mode: "insensitive" } },
				{ email: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}

	const where: Prisma.UserWhereInput = andConditions.length ? { AND: andConditions } : {};

	const [users, total] = await prisma.$transaction([
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			orderBy,
			omit: { password: true },
			include: { customer: true, rider: true },
		}),
		prisma.user.count({ where }),
	]);

	return { data: users, meta: buildMeta(page, limit, total) };
};

const getSingleUser = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		omit: { password: true },
		include: { customer: true, rider: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return user;
};

const updateUserStatus = async (userId: string, payload: IUpdateUserStatusPayload) => {
	const user = await prisma.user.findUnique({ where: { id: userId } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.role === "SUPER_ADMIN") {
		throw new AppError(httpStatus.FORBIDDEN, "Cannot change status of a Super Admin");
	}

	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: { status: payload.status },
		omit: { password: true },
	});

	return updatedUser;
};

export const UserServices = {
	uploadProfileImage,
	updateMe,
	getAllUsers,
	getSingleUser,
	updateUserStatus,
};
