import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PERIODS, resolvePeriod, type Period } from './periods.js';

/** Tuesday. The week is Mon 12 – Sun 18; the one before, Mon 5 – Sun 11. */
const TUESDAY = '2026-10-13';

const range = (period: Period, today: string) => {
  const { desde, hasta } = resolvePeriod(period, today);
  return `${desde} → ${hasta}`;
};

describe('resolvePeriod', () => {
  it('resolves every named period on an ordinary Tuesday', () => {
    const resolved = Object.fromEntries(PERIODS.map((period) => [period, range(period, TUESDAY)]));

    assert.deepEqual(resolved, {
      hoy: '2026-10-13 → 2026-10-13',
      ayer: '2026-10-12 → 2026-10-12',
      esta_semana: '2026-10-12 → 2026-10-13',
      semana_pasada: '2026-10-05 → 2026-10-11',
      este_fin_de_semana: '2026-10-10 → 2026-10-11',
      fin_de_semana_pasado: '2026-10-03 → 2026-10-04',
      este_mes: '2026-10-01 → 2026-10-13',
      mes_pasado: '2026-09-01 → 2026-09-30',
      este_anio: '2026-01-01 → 2026-10-13',
      anio_pasado: '2025-01-01 → 2025-12-31',
      ultimos_7_dias: '2026-10-07 → 2026-10-13',
      ultimos_30_dias: '2026-09-14 → 2026-10-13',
    });
  });

  describe('weeks run Monday to Sunday', () => {
    it('on a Monday, this week is just today', () => {
      assert.equal(range('esta_semana', '2026-10-12'), '2026-10-12 → 2026-10-12');
      assert.equal(range('semana_pasada', '2026-10-12'), '2026-10-05 → 2026-10-11');
    });

    it('on a Sunday, this week is the whole week and last week is the one before', () => {
      assert.equal(range('esta_semana', '2026-10-18'), '2026-10-12 → 2026-10-18');
      assert.equal(range('semana_pasada', '2026-10-18'), '2026-10-05 → 2026-10-11');
    });

    it('last week crosses months and years where the calendar does', () => {
      assert.equal(range('semana_pasada', '2026-10-01'), '2026-09-21 → 2026-09-27');
      assert.equal(range('semana_pasada', '2026-01-06'), '2025-12-29 → 2026-01-04');
    });
  });

  describe('the previous month is the whole calendar month, whatever today is', () => {
    it('gives September 1–30 on any day of October', () => {
      for (const today of ['2026-10-01', '2026-10-13', '2026-10-31']) {
        assert.equal(range('mes_pasado', today), '2026-09-01 → 2026-09-30', today);
      }
    });

    it('knows how long each month is, leap years included', () => {
      assert.equal(range('mes_pasado', '2026-03-15'), '2026-02-01 → 2026-02-28');
      assert.equal(range('mes_pasado', '2028-03-15'), '2028-02-01 → 2028-02-29');
      assert.equal(range('mes_pasado', '2026-02-10'), '2026-01-01 → 2026-01-31');
    });

    it('goes back to December of the year before in January', () => {
      assert.equal(range('mes_pasado', '2026-01-10'), '2025-12-01 → 2025-12-31');
    });

    it('this month starts on the 1st and ends today', () => {
      assert.equal(range('este_mes', '2026-10-01'), '2026-10-01 → 2026-10-01');
      assert.equal(range('este_mes', '2026-10-31'), '2026-10-01 → 2026-10-31');
    });
  });

  describe('years', () => {
    it('this year runs from January 1st to today; last year is whole', () => {
      assert.equal(range('este_anio', '2026-01-01'), '2026-01-01 → 2026-01-01');
      assert.equal(range('anio_pasado', '2026-01-01'), '2025-01-01 → 2025-12-31');
      assert.equal(range('anio_pasado', '2026-12-31'), '2025-01-01 → 2025-12-31');
    });
  });

  describe('weekends are Saturday and Sunday', () => {
    it('on a Saturday, this weekend is today so far', () => {
      assert.equal(range('este_fin_de_semana', '2026-10-17'), '2026-10-17 → 2026-10-17');
      assert.equal(range('fin_de_semana_pasado', '2026-10-17'), '2026-10-10 → 2026-10-11');
    });

    it('on a Sunday, this weekend is Saturday and today', () => {
      assert.equal(range('este_fin_de_semana', '2026-10-18'), '2026-10-17 → 2026-10-18');
    });

    it('on a weekday, this weekend is the one that just ended, never days still to come', () => {
      for (const today of ['2026-10-12', '2026-10-14', '2026-10-16']) {
        assert.equal(range('este_fin_de_semana', today), '2026-10-10 → 2026-10-11', today);
        assert.equal(range('fin_de_semana_pasado', today), '2026-10-03 → 2026-10-04', today);
      }
    });
  });

  it('never returns a range that ends after today or runs backwards', () => {
    for (const today of ['2026-01-01', '2026-02-28', '2026-10-13', '2026-12-31', '2028-02-29']) {
      for (const period of PERIODS) {
        const { desde, hasta } = resolvePeriod(period, today);
        assert.ok(desde <= hasta, `${period} on ${today}`);
        assert.ok(hasta <= today, `${period} on ${today}`);
      }
    }
  });
});
