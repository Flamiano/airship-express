const actions = ['view', 'create', 'update', 'delete'];
const view = ['view'];
const admin = actions;
const none = [];

const PERMISSIONS = {
  admin: {
    operations: admin, alerts: admin, costAnalysis: admin, driverPerformance: admin, fuelManagement: admin,
    gallery: admin, fvm: admin, vrds: admin, userManagement: admin, roleManagement: admin, systemSettings: admin,
  },
  dispatcher: {
    operations: ['view', 'create', 'update'], alerts: ['view', 'update'], costAnalysis: none, driverPerformance: view,
    fuelManagement: none, gallery: view, fvm: view, vrds: ['view', 'create', 'update'], userManagement: none,
    roleManagement: none, systemSettings: none,
  },
  fleet_manager: {
    operations: ['view', 'create', 'update'], alerts: ['view', 'update'], costAnalysis: admin, driverPerformance: view,
    fuelManagement: admin, gallery: ['view', 'create', 'update'], fvm: admin, vrds: ['view', 'create', 'update'], userManagement: none,
    roleManagement: none, systemSettings: none,
  },
  driver: {
    operations: view, alerts: view, costAnalysis: none, driverPerformance: view, fuelManagement: view,
    gallery: view, fvm: none, vrds: none, userManagement: none, roleManagement: none, systemSettings: none,
  },
};

function hasPermission(role, module, action = 'view') {
  return Boolean(PERMISSIONS[role]?.[module]?.includes(action));
}

function requirePermission(module, action = 'view') {
  return (req, res, next) => {
    if (!req.fleetUser || !hasPermission(req.fleetUser.role, module, action)) {
      return res.status(403).json({ error: `Permission denied: ${module}.${action}` });
    }
    return next();
  };
}

function permissionForMethod(module) {
  return (req, res, next) => {
    const methodAction = { GET: 'view', HEAD: 'view', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[req.method] || 'view';
    return requirePermission(module, methodAction)(req, res, next);
  };
}

module.exports = { PERMISSIONS, hasPermission, requirePermission, permissionForMethod };
