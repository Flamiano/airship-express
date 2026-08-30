import { documents } from "../data/documents"
import { Document } from "../types/document"

export async function getDocuments(): Promise<Document[]> {
  return documents
}

export async function getDocumentsByCustomerId(customerId: string): Promise<Document[]> {
  return documents.filter((d) => d.customerId === customerId)
}

export async function getDocumentsByShipmentId(shipmentId: string): Promise<Document[]> {
  return documents.filter((d) => d.shipmentId === shipmentId)
}

export async function getPendingDocumentsCount(): Promise<number> {
  return documents.filter((d) => d.podStatus === "Pending Review" || d.podStatus === "Generated").length
}
