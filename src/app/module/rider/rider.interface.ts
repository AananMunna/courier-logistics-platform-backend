export interface IVerifyRiderPayload {
	verificationStatus: "APPROVED" | "REJECTED";
	rejectionReason?: string;
}

export interface IUpdateRiderProfilePayload {
	contactNumber?: string;
	address?: string;
	currentZone?: string;
	isAvailable?: boolean;
	vehicleType?: "BICYCLE" | "MOTORCYCLE" | "VAN" | "TRUCK";
}
