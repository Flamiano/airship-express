import { describe, expect, it } from 'vitest';
import {
  isHRAdmin,
  isManager,
  canApproveTimesheets,
  canApproveLeave,
  canCreateShifts,
  canViewFullAnalytics,
  canRequestLeave,
  canManageAttendance,
  canManageLoads,
  canUseAiForecast,
} from '@/utils/rbac';

const HR = 'HR Admin' as const;
const HR_GENERALIST = 'HR Generalist' as const;
const HR_OFFICER = 'HR Officer' as const;
const MGR = 'Operations Manager' as const;
const OIC = 'Office-in-Charge' as const;
const DRIVER = 'Fleet Driver' as const;
const RIDER = 'JNT Pick-Up Rider' as const;

describe('role checks', () => {
  it('isHRAdmin', () => {
    expect(isHRAdmin(HR)).toBe(true);
    expect(isHRAdmin(HR_GENERALIST)).toBe(true);
    expect(isHRAdmin(HR_OFFICER)).toBe(true);
    expect(isHRAdmin(MGR)).toBe(false);
    expect(isHRAdmin(OIC)).toBe(false);
    expect(isHRAdmin(DRIVER)).toBe(false);
    expect(isHRAdmin(RIDER)).toBe(false);
    expect(isHRAdmin(null)).toBe(false);
    expect(isHRAdmin(undefined)).toBe(false);
  });

  it('isManager', () => {
    expect(isManager(MGR)).toBe(true);
    expect(isManager(OIC)).toBe(true);
    expect(isManager(HR)).toBe(false);
    expect(isManager(HR_GENERALIST)).toBe(false);
    expect(isManager(DRIVER)).toBe(false);
    expect(isManager(RIDER)).toBe(false);
    expect(isManager(null)).toBe(false);
  });
});

describe('approval gates (HR roles only)', () => {
  it('canApproveTimesheets', () => {
    expect(canApproveTimesheets(HR)).toBe(true);
    expect(canApproveTimesheets(HR_GENERALIST)).toBe(true);
    expect(canApproveTimesheets(HR_OFFICER)).toBe(true);
    expect(canApproveTimesheets(MGR)).toBe(false);
    expect(canApproveTimesheets(OIC)).toBe(false);
    expect(canApproveTimesheets(DRIVER)).toBe(false);
    expect(canApproveTimesheets(RIDER)).toBe(false);
  });

  it('canApproveLeave', () => {
    expect(canApproveLeave(HR)).toBe(true);
    expect(canApproveLeave(HR_GENERALIST)).toBe(true);
    expect(canApproveLeave(HR_OFFICER)).toBe(true);
    expect(canApproveLeave(MGR)).toBe(false);
    expect(canApproveLeave(OIC)).toBe(false);
    expect(canApproveLeave(DRIVER)).toBe(false);
    expect(canApproveLeave(RIDER)).toBe(false);
  });
});

describe('HR Admin + manager gates', () => {
  it('canCreateShifts', () => {
    expect(canCreateShifts(HR)).toBe(true);
    expect(canCreateShifts(HR_GENERALIST)).toBe(true);
    expect(canCreateShifts(MGR)).toBe(true);
    expect(canCreateShifts(OIC)).toBe(true);
    expect(canCreateShifts(DRIVER)).toBe(false);
    expect(canCreateShifts(RIDER)).toBe(false);
  });

  it('canViewFullAnalytics', () => {
    expect(canViewFullAnalytics(HR)).toBe(true);
    expect(canViewFullAnalytics(HR_GENERALIST)).toBe(true);
    expect(canViewFullAnalytics(MGR)).toBe(true);
    expect(canViewFullAnalytics(OIC)).toBe(true);
    expect(canViewFullAnalytics(DRIVER)).toBe(false);
    expect(canViewFullAnalytics(RIDER)).toBe(false);
  });

  it('canManageAttendance', () => {
    expect(canManageAttendance(HR)).toBe(true);
    expect(canManageAttendance(HR_GENERALIST)).toBe(true);
    expect(canManageAttendance(MGR)).toBe(true);
    expect(canManageAttendance(OIC)).toBe(true);
    expect(canManageAttendance(DRIVER)).toBe(false);
    expect(canManageAttendance(RIDER)).toBe(false);
  });

  it('canManageLoads', () => {
    expect(canManageLoads(HR)).toBe(true);
    expect(canManageLoads(HR_GENERALIST)).toBe(true);
    expect(canManageLoads(MGR)).toBe(true);
    expect(canManageLoads(OIC)).toBe(true);
    expect(canManageLoads(DRIVER)).toBe(false);
    expect(canManageLoads(RIDER)).toBe(false);
  });

  it('canUseAiForecast (Gemini AI)', () => {
    expect(canUseAiForecast(HR)).toBe(true);
    expect(canUseAiForecast(HR_GENERALIST)).toBe(true);
    expect(canUseAiForecast(HR_OFFICER)).toBe(true);
    expect(canUseAiForecast(MGR)).toBe(true);
    expect(canUseAiForecast(OIC)).toBe(true);
    expect(canUseAiForecast(DRIVER)).toBe(false);
    expect(canUseAiForecast(RIDER)).toBe(false);
    expect(canUseAiForecast(null)).toBe(false);
    expect(canUseAiForecast(undefined)).toBe(false);
  });
});

describe('any authenticated user', () => {
  it('canRequestLeave', () => {
    expect(canRequestLeave(HR)).toBe(true);
    expect(canRequestLeave(HR_GENERALIST)).toBe(true);
    expect(canRequestLeave(MGR)).toBe(true);
    expect(canRequestLeave(OIC)).toBe(true);
    expect(canRequestLeave(DRIVER)).toBe(true);
    expect(canRequestLeave(RIDER)).toBe(true);
    expect(canRequestLeave(null)).toBe(false);
    expect(canRequestLeave(undefined)).toBe(false);
  });
});
