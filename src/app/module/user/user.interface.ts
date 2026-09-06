export interface IUpdateMePayload {
	name?: string;
	customer?: {
		contactNumber?: string;
		address?: string;
	};
}

export interface IUpdateUserStatusPayload {
	status: "ACTIVE" | "BLOCKED";
}
