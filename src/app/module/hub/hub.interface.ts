export interface ICreateHubPayload {
	name: string;
	zone: string;
	address: string;
	contactNumber?: string;
}

export interface IUpdateHubPayload {
	name?: string;
	zone?: string;
	address?: string;
	contactNumber?: string;
	isActive?: boolean;
}
