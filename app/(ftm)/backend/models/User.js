function normalizeUser(record = {}) {
  return {
    ...record,
    fullName: record.full_name || record.fullName || record.email?.split('@')[0] || 'User',
    phone: record.phone || null,
    role: record.role || 'driver',
    vehicleId: record.vehicle_id || record.vehicleId || null,
  };
}

module.exports = { normalizeUser };
