type FuelLogRecord = Record<string, unknown>;
type FuelLogSource = "cost_entries" | "fuel_logs";

function firstValue(...values: unknown[]) {
  return values.find((value) => value != null && String(value).trim() !== "") ?? null;
}

function parseDetails(value: unknown): FuelLogRecord {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as FuelLogRecord : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as FuelLogRecord : {};
}

function numericValue(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeFuelLog(row: FuelLogRecord, source: FuelLogSource) {
  const details = parseDetails(firstValue(
    row.category_details,
    row.categoryDetails,
    row.category_metadata,
    row.categoryMetadata,
    row.details,
    row.metadata,
  ));
  const liters = numericValue(firstValue(row.liters, details.liters, row.quantity));
  const pricePerLiter = numericValue(firstValue(
    row.price_per_liter,
    row.pricePerLiter,
    details.price_per_liter,
    details.pricePerLiter,
  ));
  const recordedCost = numericValue(firstValue(row.amount, row.cost, row.total_cost, row.totalCost));
  const fuelType = firstValue(row.fuel_type, row.fuelType, details.fuel_type, details.fuelType);
  const station = firstValue(
    row.station,
    row.fuel_station,
    row.fuelStation,
    row.station_name,
    details.station,
    details.fuel_station,
    details.fuelStation,
  );
  const location = firstValue(row.location, details.location, details.address);
  const sourceApp = firstValue(row.source_app, row.sourceApp, row.source_module, row.sourceModule)
    ?? (source === "fuel_logs" ? "legacy_fuel_logs" : null);
  const reviewFlags = Array.isArray(row.review_flags)
    ? row.review_flags
    : Array.isArray(row.reviewFlags) ? row.reviewFlags : [];
  const id = firstValue(row.id, row.entry_id);
  const vehicleId = firstValue(row.vehicle_id, row.vehicleId);
  const receiptImage = firstValue(row.receipt_image, row.receiptImage, row.fuelReceiptImage);
  const receiptVerified = Boolean(firstValue(row.receipt_verified, row.receiptVerified));
  const flags = reviewFlags.map(String);
  if (!vehicleId && !flags.includes("Vehicle is unavailable")) flags.push("Vehicle is unavailable");
  if (!(liters != null && liters > 0) && !flags.includes("Fuel liters are unavailable")) flags.push("Fuel liters are unavailable");
  if (!(pricePerLiter != null && pricePerLiter > 0) && !flags.includes("Fuel price per liter is unavailable")) flags.push("Fuel price per liter is unavailable");
  if (liters != null && liters > 0 && pricePerLiter != null && pricePerLiter > 0
    && recordedCost != null && Math.abs(liters * pricePerLiter - recordedCost) > 0.01
    && !flags.includes("Fuel total differs from liters multiplied by price per liter")) {
    flags.push("Fuel total differs from liters multiplied by price per liter");
  }
  if (!receiptImage && !flags.includes("Fuel receipt is unavailable")) flags.push("Fuel receipt is unavailable");
  if (receiptImage && !receiptVerified && !flags.includes("Fuel receipt is not verified")) flags.push("Fuel receipt is not verified");

  return {
    id: id == null ? "" : String(id),
    sourceTable: source,
    isLegacyFuelLog: source === "fuel_logs",
    vehicleId,
    driverId: firstValue(row.driver_id, row.driverId),
    tripId: firstValue(row.trip_id, row.tripId),
    liters,
    pricePerLiter,
    cost: recordedCost,
    calculatedCost: liters != null && liters > 0 && pricePerLiter != null && pricePerLiter > 0
      ? liters * pricePerLiter
      : null,
    odometerReading: numericValue(firstValue(
      row.odometer_reading,
      row.odometerReading,
      details.odometer_reading,
      details.odometerReading,
    )),
    fuelType,
    fuel_type: fuelType,
    station,
    fuel_station: station,
    location,
    payment_method: firstValue(row.payment_method, row.paymentMethod, details.payment_method, details.paymentMethod),
    reference_number: firstValue(row.reference_number, row.referenceNumber, details.reference_number, details.referenceNumber),
    currency: firstValue(row.currency, details.currency),
    unit: firstValue(row.unit, details.unit),
    fuelReceiptImage: receiptImage,
    receipt_image: receiptImage,
    receiptVerified,
    receipt_verified: receiptVerified,
    receipt_verified_by: firstValue(row.receipt_verified_by, row.receiptVerifiedBy),
    receipt_verified_at: firstValue(row.receipt_verified_at, row.receiptVerifiedAt),
    receipt_verifier_name: firstValue(row.receipt_verifier_name, row.receiptVerifierName),
    reviewStatus: firstValue(row.review_status, row.reviewStatus, row.status) ?? "pending",
    review_status: firstValue(row.review_status, row.reviewStatus, row.status) ?? "pending",
    reviewFlags: flags,
    review_flags: flags,
    reviewNotes: firstValue(row.review_notes, row.reviewNotes),
    review_notes: firstValue(row.review_notes, row.reviewNotes),
    remarks: firstValue(row.remarks, row.description, details.note, details.description),
    source_app: sourceApp,
    entryDate: firstValue(row.entry_date, row.logged_at, row.loggedAt, row.recorded_at, row.created_at),
    loggedAt: firstValue(row.logged_at, row.loggedAt, row.entry_date, row.created_at),
    created_at: firstValue(row.created_at, row.createdAt),
    updated_at: firstValue(row.updated_at, row.updatedAt),
    created_by: firstValue(row.created_by, row.submitted_by),
    updated_by: firstValue(row.updated_by, row.modified_by),
    submitted_by: firstValue(row.submitted_by, row.created_by),
    reviewed_by: firstValue(row.reviewed_by, row.reviewedBy),
    reviewer_name: firstValue(row.reviewer_name, row.reviewerName),
    reviewed_at: firstValue(row.reviewed_at, row.reviewedAt),
    category_details: firstValue(row.category_details, row.categoryDetails, details),
  };
}

export function normalizeFuelLogs(costEntries: FuelLogRecord[], legacyFuelLogs: FuelLogRecord[]) {
  const normalizedCostEntries = costEntries
    .map((row) => normalizeFuelLog(row, "cost_entries"))
    .filter((row) => row.id);
  const costEntryIds = new Set(normalizedCostEntries.map((row) => row.id));
  const normalizedLegacyLogs = legacyFuelLogs
    .map((row) => normalizeFuelLog(row, "fuel_logs"))
    .filter((row) => row.id && !costEntryIds.has(row.id));

  return [...normalizedCostEntries, ...normalizedLegacyLogs];
}
