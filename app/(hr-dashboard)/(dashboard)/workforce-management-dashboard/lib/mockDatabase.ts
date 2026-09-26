import type { Shift, EmployeeGroup } from '../types/workforce';

export interface Employee {
  id: string;
  full_name: string;
  role: string;
  department: string;
  avatar_initials: string;
}

export const MOCK_EMPLOYEES: Employee[] = [
  { id: '1', full_name: 'Rome Louis Salvador', role: 'Office-in-Charge', department: 'Management', avatar_initials: 'RL' },
  { id: '2', full_name: 'Merilou Reyes', role: 'Project Coordinator', department: 'Management', avatar_initials: 'MR' },
  { id: '3', full_name: 'Ivie Temonio', role: 'HR Officer', department: 'Human Resources', avatar_initials: 'IT' },
  { id: '4', full_name: 'Meliza Bangkok', role: 'HR Generalist', department: 'Human Resources', avatar_initials: 'MB' },
  { id: '5', full_name: 'Chenchen Martinez', role: 'Sales Representative', department: 'Sales', avatar_initials: 'CM' },
  { id: '6', full_name: 'Welberto Arriesgado', role: 'Appraiser', department: 'Appraisal', avatar_initials: 'WA' },
  { id: '7', full_name: 'Kirl Patrick Trinidad', role: 'Office Staff', department: 'Office Operations', avatar_initials: 'KT' },
  { id: '8', full_name: 'Angelo Egos', role: 'Airship Driver', department: 'Fleet', avatar_initials: 'AE' },
  { id: '9', full_name: 'Raymond Manozo', role: 'Delivery Rider', department: 'Fleet', avatar_initials: 'RM' },
  { id: '10', full_name: 'Nowei Altarejos', role: 'Courier Driver', department: 'Fleet', avatar_initials: 'NA' },
  { id: '11', full_name: 'Mc Aldee Bernardo', role: 'Courier Driver', department: 'Fleet', avatar_initials: 'MB' },
  { id: '12', full_name: 'Wilbert Cabanayan', role: 'Courier Driver', department: 'Fleet', avatar_initials: 'WC' },
  { id: '13', full_name: 'Mark Anthony Batucan', role: 'Delivery Rider', department: 'Appraisal', avatar_initials: 'MB' },
  { id: '14', full_name: 'Kimberly Ganace', role: 'Admin Assistant', department: 'Management', avatar_initials: 'KG' },
  { id: '15', full_name: 'Carl Fornis', role: 'CSR / Marketing Staff', department: 'Sales', avatar_initials: 'CF' },
  { id: '16', full_name: 'Krishen Cafe', role: 'Delivery Rider', department: 'Fleet', avatar_initials: 'KC' },
];

export const MOCK_DB = {
  employees: MOCK_EMPLOYEES,
  
  leaveBalances: MOCK_EMPLOYEES.map((emp, i) => ({
    id: emp.id,
    name: emp.full_name,
    role: emp.role,
    sickBalance: Math.max(0, 10 - i),
    vacationBalance: Math.max(0, 15 - i),
  })),

  leaveRequests: [
    { id: 'R1', name: 'Angelo Egos', role: 'Airship Driver', type: 'Sick Leave', duration: 'Oct 15 (1 day)', balance: 2 },
    { id: 'R2', name: 'Raymond Manozo', role: 'Delivery Rider', type: 'Vacation', duration: 'Oct 20 - Oct 25 (5 days)', balance: 5 },
  ],

  shifts: [
    // Office Block
    {
      id: 'S1',
      employee_id: '1',
      shift_date: '2026-10-15',
      shift_time: '08:00 AM - 05:00 PM',
      break_time: '12:00 PM - 01:00 PM',
      priority: 'Normal',
      status: 'Scheduled',
      created_at: '2026-10-10T00:00:00Z',
      employee: { id: '1', full_name: 'Rome Louis Salvador', department: 'Management', role: 'Office-in-Charge' },
    },
    {
      id: 'S2',
      employee_id: '3',
      shift_date: '2026-10-15',
      shift_time: '09:00 AM - 06:00 PM',
      break_time: '01:00 PM - 02:00 PM',
      priority: 'Normal',
      status: 'In Progress',
      created_at: '2026-10-10T00:00:00Z',
      employee: { id: '3', full_name: 'Ivie Temonio', department: 'Human Resources', role: 'HR Officer' },
    },
    // Rider Arrivals
    {
      id: 'S3',
      title: 'Morning Route - North',
      employee_id: '8',
      shift_date: '2026-10-15',
      fleet_data: {
        expected_arrival: '07:30 AM',
        priority: 'High',
        vehicle: 'Van 1',
      },
      gate_in: '07:25 AM',
      gate_out: null,
      status: 'In Progress',
      created_at: '2026-10-10T00:00:00Z',
      employee: { id: '8', full_name: 'Angelo Egos', department: 'Fleet', role: 'Airship Driver' },
    },
    {
      id: 'S4',
      title: 'Afternoon Deliveries',
      employee_id: '9',
      shift_date: '2026-10-15',
      fleet_data: {
        expected_arrival: '01:00 PM',
        priority: 'Normal',
        vehicle: 'Truck 3',
      },
      gate_in: null,
      gate_out: null,
      status: 'Pending Driver',
      created_at: '2026-10-10T00:00:00Z',
      employee: { id: '9', full_name: 'Raymond Manozo', department: 'Fleet', role: 'Delivery Rider' },
    },
  ] as Shift[],

  analytics: MOCK_EMPLOYEES.map((emp, i) => ({
    id: emp.id,
    full_name: emp.full_name,
    role: emp.role,
    category: i % 3 === 0 ? 'Tardy' : 'On-Time',
    onTimeRate: `${100 - (i % 3) * 10}%`,
    lates: (i % 3) * 3,
    avatar_initials: emp.avatar_initials,
  })),

  timesheets: MOCK_EMPLOYEES.slice(0, 5).map((emp, i) => ({
    id: `TS-${emp.id}`,
    employeeId: emp.id,
    full_name: emp.full_name,
    role: emp.role,
    date: '2026-10-14',
    clockIn: '08:00 AM',
    clockOut: '05:00 PM',
    status: i % 2 === 0 ? 'Approved' : 'Pending',
    totalHours: '9.0',
  })),

  attendance: MOCK_EMPLOYEES.map(emp => ({
    id: `ATT-${emp.id}`,
    employee_id: emp.id,
    action: 'TIME_IN',
    status: 'On-Time',
    time_in: '2026-10-15T08:00:00Z',
    time_out: null,
    shift_start: '2026-10-15T08:00:00Z',
    shift_end: '2026-10-15T17:00:00Z',
    terminal: 'ESP32-GATE-01',
    last_scan: '2026-10-15T08:00:00Z',
    created_at: '2026-10-15T08:00:00Z',
    employee: {
      id: emp.id,
      email: `${emp.full_name.toLowerCase().replace(/ /g, '.')}@airship.com`,
      full_name: emp.full_name,
      role: emp.role as any,
      department: emp.department,
      avatar_initials: emp.avatar_initials,
      terminal: emp.department,
      created_at: '',
    }
  })),

  dashboardAnalytics: {
    forecast: [
      { id: '1', month: 'Jul', freight_volume: 120, current_staff: 50, required_staff: 55, deficit: 5, created_at: '' },
      { id: '2', month: 'Aug', freight_volume: 130, current_staff: 52, required_staff: 60, deficit: 8, created_at: '' },
      { id: '3', month: 'Sep', freight_volume: 150, current_staff: 61, required_staff: 61, deficit: 0, created_at: '' },
    ],
    skilling: [],
    performance: { 
      id: 'mock-perf-1',
      snapshot_date: '2026-10-15',
      avg_rating: 4.5, 
      on_time_rate: 94, 
      task_completion_rate: 98,
      active_courses: 5,
      top_performers_pct: 38,
      steady_workers_pct: 48,
      needs_review_pct: 14,
      created_at: '2026-10-15',
    },
    workforce: 61,
  },
};
