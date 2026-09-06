import type { IQuery } from "../interfaces";

export const buildPagination = (query: IQuery) => {
	const page = Math.max(Number(query.page) || 1, 1);
	const limit = Math.max(Number(query.limit) || 10, 1);
	const skip = (page - 1) * limit;

	const sortBy = query.sortBy || "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	return {
		page,
		limit,
		skip,
		orderBy: { [sortBy]: sortOrder } as Record<string, "asc" | "desc">,
	};
};

export const buildMeta = (page: number, limit: number, total: number) => ({
	page,
	limit,
	total,
	totalPages: Math.max(Math.ceil(total / limit), 1),
});
