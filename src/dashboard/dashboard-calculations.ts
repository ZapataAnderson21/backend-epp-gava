export const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

// Timestamps use Lima; payroll weeks and document expiry are calendar dates.
export const limaDate = (date: Date) =>
  new Date(date.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function dashboardPeriod(month: number, year: number) {
  const dates = Array.from(
    { length: 6 },
    (_, index) => new Date(Date.UTC(year, month - 6 + index, 1)),
  );
  const endDate = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return {
    keys: dates.map((date) => date.toISOString().slice(0, 7)),
    from: new Date(`${dates[0].toISOString().slice(0, 10)}T00:00:00-05:00`),
    to: new Date(`${endDate}T00:00:00-05:00`),
    startDate: dates[5].toISOString().slice(0, 10),
    endDate,
  };
}

export function dashboardPermissions(roles: string[]) {
  const has = (...allowed: string[]) =>
    allowed.some((role) => roles.includes(role));
  const purchases = has('GERENTE', 'ADMINISTRADORA', 'LOGISTICA');
  const registeredIncome = has('GERENTE', 'ADMINISTRADORA', 'ADMINISTRADOR');
  return {
    // A complete result must never expose a source the user cannot access.
    finance: purchases && registeredIncome,
    purchases,
    payroll: has('GERENTE', 'ADMINISTRADORA', 'ADMINISTRADOR', 'LOGISTICA'),
    documents: has(
      'GERENTE',
      'ADMINISTRADORA',
      'LOGISTICA',
      'PREVENCIONISTA DE RIESGOS',
    ),
  };
}

export const attendanceDays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
type Numeric = number | string | { toString(): string };
type PayrollValues = Record<
  | (typeof attendanceDays)[number]
  | 'dominical'
  | 'overtimeAmount'
  | 'afpDiscount'
  | 'advanceDiscount',
  Numeric
>;

export function payrollAmounts(entry: PayrollValues, dailyWage: Numeric) {
  const attendances = attendanceDays.reduce(
    (sum, day) => sum + Number(entry[day]),
    0,
  );
  const dominical = Number(entry.dominical);
  const gross =
    (attendances + dominical) * Number(dailyWage) +
    Number(entry.overtimeAmount);
  return {
    attendances,
    dominical,
    base: roundMoney(
      gross - Number(entry.afpDiscount) - Number(entry.advanceDiscount),
    ),
  };
}

export const emptyAmounts = () => ({
  income: 0,
  materials: 0,
  services: 0,
  payroll: 0,
  pettyCash: 0,
  adjustments: 0,
});
export type DashboardAmounts = ReturnType<typeof emptyAmounts>;
export function summarizeAmounts(amounts: DashboardAmounts) {
  const rounded = Object.fromEntries(
    Object.entries(amounts).map(([key, value]) => [key, roundMoney(value)]),
  ) as DashboardAmounts;
  const expenses = roundMoney(
    rounded.materials +
      rounded.services +
      rounded.payroll +
      rounded.pettyCash +
      rounded.adjustments,
  );
  return {
    ...rounded,
    expenses,
    result: roundMoney(rounded.income - expenses),
  };
}
