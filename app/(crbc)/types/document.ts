export type PODStatus = "Generated" | "Pending Review" | "Approved" | "Released"

export interface Document {
  id: string;
  documentId: string
  shipmentId: string
  customerId: string
  documentType: string
  podStatus: PODStatus
  generatedDate: string
}
