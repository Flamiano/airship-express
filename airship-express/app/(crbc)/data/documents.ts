import { Document } from "../types/document";
export const documents: Document[] = [
  {
    id: "1",
    documentId: "DOC-0001",
    shipmentId: "SHP-0001",
    customerId: "CUS-0001",
    documentType: "Proof of Delivery",
    podStatus: "Approved",
    generatedDate: "2026-08-16T12:17:19.840114+00:00",
  },
  {
    id: "2",
    documentId: "DOC-0002",
    shipmentId: "SHP-0002",
    customerId: "CUS-0002",
    documentType: "Proof of Delivery",
    podStatus: "Pending Review",
    generatedDate: "2026-08-15T09:30:00+00:00",
  },
  {
    id: "3",
    documentId: "DOC-0003",
    shipmentId: "SHP-0003",
    customerId: "CUS-0003",
    documentType: "Proof of Delivery",
    podStatus: "Released",
    generatedDate: "2026-08-14T14:45:00+00:00",
  },
];