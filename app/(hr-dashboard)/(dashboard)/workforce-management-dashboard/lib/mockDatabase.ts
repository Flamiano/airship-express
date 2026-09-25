import type { Shift, EmployeeGroup } from '../types/workforce';

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
}

export const MOCK_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Rome Louis Salvador', role: 'Office-in-Charge', department: 'Management', avatar: 'RL' },
  { id: '2', name: 'Merilou Reyes', role: 'Project Coordinator', department: 'Management', avatar: 'MR' },
  { id: '3', name: 'Ivie Temonio', role: 'HR Officer', department: 'Human Resources', avatar: 'IT' },
  { id: '4', name: 'Meliza Bangkok', role: 'HR Generalist', department: 'Human Resources', avatar: 'MB' },
  { id: '5', name: 'Chenchen Martinez', role: 'Sales Representative', department: 'Sales', avatar: 'CM' },
  { id: '6', name: 'Welberto Arriesgado', role: 'Appraiser', department: 'Appraisal', avatar: 'WA' },
  { id: '7', name: 'Kirl Patrick Trinidad', role: 'Office Staff', department: 'Office Operations', avatar: 'KT' },
  { id: '8', name: 'Angelo Egos', role: 'Airship Driver', department: 'Fleet', avatar: 'AE' },
  { id: '9', name: 'Raymond Manozo', role: 'Delivery Rider', department: 'Fleet', avatar: 'RM' },
  { id: '10', name: 'Nowei Altarejos', role: 'Courier Driver', department: 'Fleet', avatar: 'NA' },
  { id: '11', name: 'Mc Aldee Bernardo', role: 'Courier Driver', department: 'Fleet', avatar: 'MB' },
  { id: '12', name: 'Wilbert Cabanayan', role: 'Courier Driver', department: 'Fleet', avatar: 'WC' },
  { id: '13', name: 'Mark Anthony Batucan', role: 'Delivery Rider', department: 'Appraisal', avatar: 'MB' },
  { id: '14', name: 'Kimberly Ganace', role: 'Admin Assistant', department: 'Management', avatar: 'KG' },
  { id: '15', name: 'Carl Fornis', role: 'CSR / Marketing Staff', department: 'Sales', avatar: 'CF' },
  { id: '16', name: 'Krishen Cafe', role: 'Delivery Rider', department: 'Fleet', avatar: 'KC' },
];

export const MOCK_DB = {
  employees: MOCK_EMPLOYEES,
  
  leaveBalances: MOCK_EMPLOYEES.map((emp, i) => ({
    id: emp.id,
    name: emp.name,
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
      break_duration_minutes: 60,
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
      break_duration_minutes: 30,
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
      expected_arrival: '07:30 AM',
      gate_in: '07:25 AM',
      gate_out: null,
      priority: 'High',
      status: 'In Progress',
      vehicle: 'Van 1',
      created_at: '2026-10-10T00:00:00Z',
      employee: { id: '8', full_name: 'Angelo Egos', department: 'Fleet', role: 'Airship Driver' },
    },
    {
      id: 'S4',
      title: 'Afternoon Deliveries',
      employee_id: '9',
      shift_date: '2026-10-15',
      expected_arrival: '01:00 PM',
      gate_in: null,
      gate_out: null,
      priority: 'Medium',
      status: 'Pending Driver',
      vehicle: 'Truck 3',
      created_at: '2026-10-10T00:00:00Z',
      employee: { id: '9', full_name: 'Raymond Manozo', department: 'Fleet', role: 'Delivery Rider' },
    },
  ] as Shift[],

  analytics: MOCK_EMPLOYEES.map((emp, i) => ({
    id: emp.id,
    name: emp.name,
    role: emp.role,
    category: i % 3 === 0 ? 'Tardy' : 'On-Time',
    onTimeRate: `${100 - (i % 3) * 10}%`,
    lates: (i % 3) * 3,
    avatar: emp.avatar,
  })),

  timesheets: MOCK_EMPLOYEES.slice(0, 5).map((emp, i) => ({
    id: `TS-${emp.id}`,
    employeeId: emp.id,
    name: emp.name,
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
      email: `${emp.name.toLowerCase().replace(/ /g, '.')}@airship.com`,
      full_name: emp.name,
      role: emp.role as any,
      avatar_initials: emp.avatar,
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
