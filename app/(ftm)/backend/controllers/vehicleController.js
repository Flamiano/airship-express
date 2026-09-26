const { getServiceSupabase } = require('../config/db');
const { normalizeVehicle, buildVehiclePayload } = require('../models/Vehicle');

function isPermissionError(error) {
  const message = (error?.message || error || '').toString().toLowerCase();
  return message.includes('permission denied') || message.includes('not authorized') || message.includes('rls') || message.includes('jwt');
}

function isVehicleIdConflict(error) {
  return String(error?.code || '').trim() === '23505' && /vehicles_pkey|duplicate key/i.test(String(error?.message || error || ''));
}

function isMissingAssignmentStatusColumn(error) {
  return /assignment_status|schema cache|column .* does not exist/i.test(String(error?.message || error || ''));
}

async function getNextVehicleId(supabase, courierId) {
  const { data, error } = await supabase.from('vehicles').select('id, courier_id');
  if (error) throw error;

  const vehicles = Array.isArray(data) ? data : [];
  const { data: courier } = courierId
    ? await supabase.from('couriers').select('code').eq('id', courierId).maybeSingle()
    : { data: null };
  const prefix = String(courier?.code || 'VH').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'VH';
  const assignedVehicles = courierId
    ? vehicles.filter((vehicle) => {
        const vehicleId = String(vehicle.id || '').toUpperCase();
        return String(vehicle.courier_id || '') === String(courierId) || vehicleId.startsWith(`${prefix}-`);
      })
    : vehicles;
  const usedIds = new Set(vehicles.map((vehicle) => String(vehicle.id || '')));
  const highestNumber = assignedVehicles.reduce((highest, vehicle) => {
    const match = String(vehicle.id || '').match(/(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  let nextNumber = highestNumber + 1;
  let candidate = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  while (usedIds.has(candidate)) {
    nextNumber += 1;
    candidate = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  }
  return candidate;
}

async function getVehicles(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  let query = supabase.from('vehicles').select('*').order('created_at', { ascending: false });
  if (req.query.plate_number) query = query.ilike('plate_number', String(req.query.plate_number).trim());
  const { data, error } = await query;
  if (error) {
    console.error('Supabase vehicles query error:', error.message || error);
    if (isPermissionError(error)) {
      return res.status(403).json({
        error: 'Vehicle list is not available from Supabase yet',
        details: 'Enable service-role access or apply the required RLS policies before querying vehicles.',
      });
    }
    return res.status(500).json({
      error: 'Unable to load vehicles',
      details: error.message || 'permission denied for table vehicles',
    });
  }

  const courierIds = [...new Set((data || []).map((vehicle) => vehicle.courier_id).filter(Boolean))];
  const { data: couriers } = courierIds.length > 0
    ? await supabase.from('couriers').select('id, name, code').in('id', courierIds)
    : { data: [] };
  const courierById = new Map((couriers || []).map((courier) => [String(courier.id), courier]));
  return res.json((data || []).map((vehicle) => normalizeVehicle({
    ...vehicle,
    courier: courierById.get(String(vehicle.courier_id))?.name || null,
  })));
}

async function getNextVehicleIdRoute(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  try {
    const id = await getNextVehicleId(supabase, req.query.courier_id);
    return res.json({ id });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to calculate the next vehicle ID', details: error.message });
  }
}

async function getCouriers(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase
    .from('couriers')
    .select('id, code, name')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Supabase couriers query error:', error.message || error);
    return res.status(500).json({ error: 'Unable to load couriers', details: error.message });
  }

  return res.json(data || []);
}

async function createVehicle(req, res) {
  const vehicle = req.body;
  const payload = buildVehiclePayload(vehicle);

  payload.status = 'Available';
  payload.availability = 'Available';
  payload.assignment_status = payload.courier_id ? 'pending' : null;

  if (!payload.id || !payload.plate_number || !payload.vehicle_type) {
    return res.status(400).json({ error: 'id, plate_number, and vehicle_type are required' });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data: duplicate } = await supabase
    .from('vehicles')
    .select('id')
    .ilike('plate_number', payload.plate_number)
    .limit(1);
  if (duplicate?.length) return res.status(409).json({ error: 'This plate number is already registered.' });

  let { data, error } = await supabase.from('vehicles').insert(payload).select('*').single();
  if (error && isMissingAssignmentStatusColumn(error)) {
    // Older deployments may not have applied the assignment-status migration yet.
    // Keep vehicle creation compatible while the migration is applied.
    const legacyPayload = { ...payload };
    delete legacyPayload.assignment_status;
    ({ data, error } = await supabase.from('vehicles').insert(legacyPayload).select('*').single());
  }
  if (error && isVehicleIdConflict(error)) {
    try {
      payload.id = await getNextVehicleId(supabase, payload.courier_id);
      ({ data, error } = await supabase.from('vehicles').insert(payload).select('*').single());
      if (error && isMissingAssignmentStatusColumn(error)) {
        const legacyPayload = { ...payload };
        delete legacyPayload.assignment_status;
        ({ data, error } = await supabase.from('vehicles').insert(legacyPayload).select('*').single());
      }
    } catch (retryError) {
      error = retryError;
    }
  }
  if (error) {
    if (isPermissionError(error)) {
      return res.status(403).json({
        error: 'Vehicle could not be created in Supabase',
        details: 'Enable service-role access or apply the required RLS policies before writing vehicles.',
      });
    }
    return res.status(500).json({ error: `Unable to create vehicle: ${error.message}` });
  }
  if (payload.courier_id) {
    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: payload.courier_id,
      title: 'Vehicle assignment request',
      message: `You have been assigned vehicle ${data.plate_number || data.id}. Accept or reject it in the driver app.`,
      is_read: false,
    });
    if (notificationError) {
      console.warn('Vehicle created but assignment notification could not be sent:', notificationError.message || notificationError);
    }
  }
  return res.status(201).json(normalizeVehicle(data));
}

async function createVehicleDocument(req, res) {
  const document = req.body || {};
  if (!document.vehicle_id || !document.document_type || !document.file_url) {
    return res.status(400).json({ error: 'vehicle_id, document_type, and file_url are required' });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase.from('vehicle_documents').insert({
    vehicle_id: String(document.vehicle_id),
    document_type: String(document.document_type),
    document_number: document.document_number || null,
    expiry_date: document.expiry_date || null,
    file_url: String(document.file_url),
    status: document.status || 'Valid',
  }).select('*').single();

  if (error) return res.status(500).json({ error: 'Unable to save vehicle document', details: error.message });
  return res.status(201).json(data);
}

async function uploadVehicleDocument(req, res) {
  const bucketName = 'vehicle-documents';
  const document = req.body || {};
  const content = String(document.content || '');
  if (!document.path || !content) {
    return res.status(400).json({ error: 'path and content are required' });
  }

  let file;
  try {
    file = Buffer.from(content, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid document content' });
  }

  if (!file.length) return res.status(400).json({ error: 'Document content is empty' });
  if (file.length > 15 * 1024 * 1024) return res.status(413).json({ error: 'Document file is too large' });

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  let bucketExists = false;
  const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
  if (!bucketListError) bucketExists = (buckets || []).some((bucket) => bucket.id === bucketName || bucket.name === bucketName);

  if (!bucketExists) {
    const { error: bucketCreateError } = await supabase.storage.createBucket(bucketName, { public: false });
    if (bucketCreateError && !/already exists|duplicate/i.test(bucketCreateError.message || '')) {
      return res.status(503).json({
        error: 'Unable to initialize document storage',
        details: `${bucketCreateError.message}. Configure FTM_SUPABASE_SERVICE_ROLE_KEY and restart the backend.`,
      });
    }
  }

  const { error } = await supabase.storage.from(bucketName).upload(String(document.path), file, {
    contentType: document.content_type || 'application/octet-stream',
    upsert: false,
  });
  if (error) return res.status(500).json({ error: 'Unable to upload vehicle document', details: error.message });
  return res.status(201).json({ path: String(document.path) });
}

module.exports = { getVehicles, getNextVehicleIdRoute, createVehicle, getCouriers, createVehicleDocument, uploadVehicleDocument };
