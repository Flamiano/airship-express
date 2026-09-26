const CATEGORY_TABLES = {
  Fuel: 'fuel_costs',
  Maintenance: 'maintenance_costs',
  Toll: 'toll_costs',
  Parking: 'parking_costs',
  Other: 'other_costs',
};

const CATEGORY_SELECTS = {
  Fuel: 'cost_entry_id,liters,odometer_reading,created_at',
  Maintenance: 'cost_entry_id,maintenance_type,created_at',
  Toll: 'cost_entry_id,toll_location,created_at',
  Parking: 'cost_entry_id,parking_location,created_at',
  Other: 'cost_entry_id,description,created_at',
};

function categoryPayload(category, record, costEntryId) {
  const base = { cost_entry_id: costEntryId };
  if (category === 'Fuel') return { ...base, liters: record.liters ?? null, odometer_reading: record.odometer_reading ?? null };
  if (category === 'Maintenance') return { ...base, maintenance_type: record.maintenance_type ?? null };
  if (category === 'Toll') return { ...base, toll_location: record.toll_location ?? null };
  if (category === 'Parking') return { ...base, parking_location: record.parking_location ?? null };
  if (category === 'Other') return { ...base, description: record.description ?? record.remarks ?? null };
  return null;
}

async function attachCategoryCost(supabase, category, record, costEntryId) {
  const payload = categoryPayload(category, record, costEntryId);
  if (!payload) return null;
  const { data, error } = await supabase
    .from(CATEGORY_TABLES[category])
    .upsert(payload, { onConflict: 'cost_entry_id' })
    .select(CATEGORY_SELECTS[category])
    .single();
  if (error) throw error;
  return data;
}

async function loadCategoryCosts(supabase, rows) {
  const result = new Map();
  await Promise.all(Object.entries(CATEGORY_TABLES).map(async ([category, table]) => {
    const { data, error } = await supabase.from(table).select(CATEGORY_SELECTS[category]);
    if (error) throw error;
    (data || []).forEach((item) => {
      const existing = result.get(item.cost_entry_id) || {};
      result.set(item.cost_entry_id, { ...existing, category, ...item });
    });
  }));
  return rows.map((row) => ({ ...row, categoryCost: result.get(row.id) || null }));
}

module.exports = { attachCategoryCost, loadCategoryCosts };
