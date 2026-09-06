import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildMeta, buildPagination } from "../../utils/queryHelper";
import type { ICreateHubPayload, IUpdateHubPayload } from "./hub.interface";

const createHub = async (payload: ICreateHubPayload) => {
	const existingHub = await prisma.hub.findUnique({
		where: { unique_hub_name_zone: { name: payload.name, zone: payload.zone } },
	});

	if (existingHub) {
		throw new AppError(httpStatus.CONFLICT, "A hub with this name already exists in this zone");
	}

	const hub = await prisma.hub.create({ data: payload });
	return hub;
};

const getAllHubs = async (query: IQuery) => {
	const { page, limit, skip, orderBy } = buildPagination(query);

	const andConditions: Prisma.HubWhereInput[] = [{ isDeleted: false }];

	if (query.zone) {
		andConditions.push({ zone: { equals: query.zone as string, mode: "insensitive" } });
	}

	if (query.isActive !== undefined) {
		andConditions.push({ isActive: query.isActive === "true" });
	}

	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{ name: { contains: query.searchTerm, mode: "insensitive" } },
				{ zone: { contains: query.searchTerm, mode: "insensitive" } },
				{ address: { contains: query.searchTerm, mode: "insensitive" } },
			],
		});
	}

	const where: Prisma.HubWhereInput = { AND: andConditions };

	const [hubs, total] = await prisma.$transaction([
		prisma.hub.findMany({ where, skip, take: limit, orderBy }),
		prisma.hub.count({ where }),
	]);

	return { data: hubs, meta: buildMeta(page, limit, total) };
};

const getSingleHub = async (hubId: string) => {
	const hub = await prisma.hub.findUnique({ where: { id: hubId } });

	if (!hub || hub.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Hub not found");
	}

	return hub;
};

const updateHub = async (hubId: string, payload: IUpdateHubPayload) => {
	const hub = await prisma.hub.findUnique({ where: { id: hubId } });

	if (!hub || hub.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Hub not found");
	}

	const updatedHub = await prisma.hub.update({ where: { id: hubId }, data: payload });
	return updatedHub;
};

const deleteHub = async (hubId: string) => {
	const hub = await prisma.hub.findUnique({ where: { id: hubId } });

	if (!hub || hub.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Hub not found");
	}

	const activeShipmentCount = await prisma.shipment.count({
		where: {
			isDeleted: false,
			OR: [{ originHubId: hubId }, { destinationHubId: hubId }],
			status: { notIn: ["DELIVERED", "CANCELLED", "RETURNED", "FAILED"] },
		},
	});

	if (activeShipmentCount > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete a hub that has active shipments assigned to it",
		);
	}

	const deletedHub = await prisma.hub.update({
		where: { id: hubId },
		data: { isDeleted: true, deletedAt: new Date(), isActive: false },
	});

	return deletedHub;
};

export const HubServices = {
	createHub,
	getAllHubs,
	getSingleHub,
	updateHub,
	deleteHub,
};
