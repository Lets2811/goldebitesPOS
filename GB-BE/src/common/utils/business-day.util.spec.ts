import {
  addDays,
  businessDayRange,
  businessDayStart,
  businessToday,
  daysInRange,
  isCalendarDay,
} from './business-day.util';

const BOGOTA = 'America/Bogota';

describe('business-day util', () => {
  describe('isCalendarDay', () => {
    it('accepts real days written as YYYY-MM-DD', () => {
      expect(isCalendarDay('2026-10-13')).toBe(true);
      expect(isCalendarDay('2028-02-29')).toBe(true);
    });

    it('rejects other formats and days that do not exist', () => {
      expect(isCalendarDay('2026-02-30')).toBe(false);
      expect(isCalendarDay('2026-13-01')).toBe(false);
      expect(isCalendarDay('13/10/2026')).toBe(false);
      expect(isCalendarDay('2026-10-13T00:00:00Z')).toBe(false);
      expect(isCalendarDay('ayer')).toBe(false);
    });
  });

  describe('businessDayStart', () => {
    it('is midnight in the business, not in UTC', () => {
      expect(businessDayStart('2026-10-13', BOGOTA).toISOString()).toBe(
        '2026-10-13T05:00:00.000Z',
      );
      expect(businessDayStart('2026-10-13', 'UTC').toISOString()).toBe(
        '2026-10-13T00:00:00.000Z',
      );
    });

    it('follows a timezone through its clock changes', () => {
      // Madrid is UTC+1 in winter and UTC+2 in summer.
      expect(
        businessDayStart('2026-01-15', 'Europe/Madrid').toISOString(),
      ).toBe('2026-01-14T23:00:00.000Z');
      expect(
        businessDayStart('2026-07-15', 'Europe/Madrid').toISOString(),
      ).toBe('2026-07-14T22:00:00.000Z');
      // The day the clocks go forward starts under the winter offset.
      expect(
        businessDayStart('2026-03-29', 'Europe/Madrid').toISOString(),
      ).toBe('2026-03-28T23:00:00.000Z');
    });
  });

  describe('businessDayRange', () => {
    it('covers one whole day, to its last millisecond', () => {
      expect(businessDayRange('2026-10-13', '2026-10-13', BOGOTA)).toEqual({
        dateFrom: '2026-10-13T05:00:00.000Z',
        dateTo: '2026-10-14T04:59:59.999Z',
      });
    });

    it('keeps a late-night sale in the day it was made', () => {
      const { dateFrom, dateTo } = businessDayRange(
        '2026-10-13',
        '2026-10-13',
        BOGOTA,
      );
      // 11:30 PM on the 13th in Bogotá is already the 14th in UTC.
      const lateSale = '2026-10-14T04:30:00.000Z';
      expect(lateSale >= dateFrom && lateSale <= dateTo).toBe(true);
      // 11:30 PM on the 12th belongs to the day before.
      const previousNight = '2026-10-13T04:30:00.000Z';
      expect(previousNight >= dateFrom).toBe(false);
    });

    it('spans months and years', () => {
      expect(businessDayRange('2026-12-31', '2027-01-01', BOGOTA)).toEqual({
        dateFrom: '2026-12-31T05:00:00.000Z',
        dateTo: '2027-01-02T04:59:59.999Z',
      });
    });
  });

  describe('businessToday', () => {
    it('is still yesterday in Bogotá when UTC has already changed day', () => {
      const lateEvening = new Date('2026-10-14T02:00:00.000Z'); // 9 PM on the 13th in Bogotá
      expect(businessToday(BOGOTA, lateEvening)).toBe('2026-10-13');
      expect(businessToday('UTC', lateEvening)).toBe('2026-10-14');
    });
  });

  it('addDays() moves across months, years and leap days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('daysInRange() counts both ends', () => {
    expect(daysInRange('2026-10-13', '2026-10-13')).toBe(1);
    expect(daysInRange('2026-09-01', '2026-09-30')).toBe(30);
    expect(daysInRange('2026-01-01', '2026-12-31')).toBe(365);
    expect(daysInRange('2028-01-01', '2028-12-31')).toBe(366);
  });
});
