export interface IInitiatePaymentPayload {
	shipmentId: string;
}

export interface IRefundPaymentPayload {
	shipmentId: string;
	refundReason: string;
}
