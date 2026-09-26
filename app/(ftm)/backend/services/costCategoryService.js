function parseJsonMaybe(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }
  if (typeof value === 'object') {
    return value;
  }
  return {};
}

function buildCategoryDetails(category, record = {}) {
  const base = parseJsonMaybe(record.category_details ?? record.categoryDetails ?? record.category_metadata ?? record.categoryMetadata ?? record.details ?? record.metadata ?? null);
  const source = { ...base, ...(record || {}) };

  if (!category) return source;

  const normalized = {
    category,
    note: source.note ?? source.remarks ?? source.description ?? null,
    description: source.description ?? source.remarks ?? source.note ?? null,
  };

  if (category === 'Fuel') {
    return {
      ...normalized,
      liters: source.liters ?? source.quantity ?? null,
      odometer_reading: source.odometer_reading ?? source.odometerReading ?? null,
      fuel_station: source.fuel_station ?? source.fuelStation ?? null,
      fuel_type: source.fuel_type ?? source.fuelType ?? null,
      reference_number: source.reference_number ?? source.referenceNumber ?? null,
      location: source.location ?? null,
      payment_method: source.payment_method ?? source.paymentMethod ?? null,
    };
  }

  if (category === 'Maintenance') {
    return {
      ...normalized,
      maintenance_type: source.maintenance_type ?? source.maintenanceType ?? source.type ?? null,
      vendor: source.vendor ?? null,
      service_date: source.service_date ?? source.serviceDate ?? null,
    };
  }

  if (category === 'Toll') {
    return {
      ...normalized,
      toll_location: source.toll_location ?? source.tollLocation ?? null,
      vehicle_number: source.vehicle_number ?? source.vehicleNumber ?? null,
    };
  }

  if (category === 'Parking') {
    return {
      ...normalized,
      parking_location: source.parking_location ?? source.parkingLocation ?? null,
      duration_hours: source.duration_hours ?? source.durationHours ?? null,
    };
  }

  if (category === 'Other') {
    return {
      ...normalized,
      description: source.description ?? source.remarks ?? source.note ?? null,
    };
  }

  return normalized;
}

function extractCategoryCost(entry = {}) {
  const rawDetails = parseJsonMaybe(entry.category_details ?? entry.categoryDetails ?? entry.category_metadata ?? entry.categoryMetadata ?? entry.details ?? entry.metadata ?? null);
  if (rawDetails && Object.keys(rawDetails).length) {
    return rawDetails;
  }

  const key = entry.category ?? 'Other';
  return {
    category: key,
    note: entry.note ?? entry.remarks ?? entry.description ?? null,
    description: entry.description ?? entry.remarks ?? entry.note ?? null,
    liters: entry.liters ?? null,
    odometer_reading: entry.odometer_reading ?? entry.odometerReading ?? null,
    fuel_station: entry.fuel_station ?? entry.fuelStation ?? null,
    toll_location: entry.toll_location ?? entry.tollLocation ?? null,
    parking_location: entry.parking_location ?? entry.parkingLocation ?? null,
    maintenance_type: entry.maintenance_type ?? entry.maintenanceType ?? null,
  };
}

async function attachCategoryCost(supabase, category, record, costEntryId) {
  if (!supabase || !costEntryId || !category) return null;
  const payload = buildCategoryDetails(category, record || {});
  if (!payload || Object.keys(payload).length === 0) return null;

  const { data, error } = await supabase
    .from('cost_entries')
    .update({ category_details: payload })
    .eq('id', costEntryId)
    .select('id,category_details')
    .single();

  if (error) {
    const message = String(error.message || error || '');
    if (/column .*category_details|does not exist|not found/i.test(message)) {
      return payload;
    }
    throw error;
  }

  return data?.category_details ?? payload;
}

async function loadCategoryCosts(_supabase, rows) {
  return (rows || []).map((row) => ({
    ...row,
    categoryCost: extractCategoryCost(row),
  }));
}

module.exports = { attachCategoryCost, loadCategoryCosts, buildCategoryDetails, extractCategoryCost };
