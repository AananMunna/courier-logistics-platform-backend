export interface ICreateShipmentPayload {
	parcelType?: "DOCUMENT" | "PARCEL" | "FRAGILE" | "ELECTRONICS" | "FOOD" | "OTHER";
	parcelDescription?: string;
	weightKg: number;

	pickupAddress: string;
	pickupContactName: string;
	pickupContactPhone: string;

	deliveryAddress: string;
	deliveryContactName: string;
	deliveryContactPhone: string;

	distanceKm?: number;

	isCod?: boolean;
	codAmount?: number;

	scheduledPickupAt?: string;

	originHubId: string;
	destinationHubId: string;
}

export interface IAssignRiderPayload {
	riderId: string;
	note?: string;
}

export interface IUpdateShipmentStatusPayload {
	status: "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "FAILED" | "RETURNED";
	note?: string;
	failureReason?: string;
}

export interface ICancelShipmentPayload {
	cancelReason?: string;
}
