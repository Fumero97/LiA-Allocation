import { parseDateShared } from '../lib/dateUtils';

export const EMPTY_GROUP = () => ({ name: '', arrivalDate: '', departureDate: '', struttura: '', agente: '' });

export const fmtDate = (val) => {
  if (!val) return '—';
  let d;
  if (val instanceof Date) {
    d = val;
  } else {
    const s = String(val);
    const parts = s.split('/');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      const [y, m, day] = s.split('-').map(Number);
      d = new Date(y, m - 1, day);
    }
  }
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const computeGroupDateRange = (groupName, allGuests) => {
  const guests = allGuests.filter(g => g.group === groupName);
  const arrivals   = guests.map(g => parseDateShared(g.arrivalDate)).filter(Boolean);
  const departures = guests.map(g => parseDateShared(g.departureDate)).filter(Boolean);
  return {
    arrivalDate:   arrivals.length   ? new Date(Math.min(...arrivals.map(d => d.getTime())))   : null,
    departureDate: departures.length ? new Date(Math.max(...departures.map(d => d.getTime()))) : null,
  };
};

export const computeIntakes = (groupName, allGuests, savedIntakes) => {
  const guests = allGuests.filter(g => g.group === groupName);
  if (!guests.length) return [];
  return savedIntakes.filter(intake => {
    if (!intake.startDate || !intake.endDate) return false;
    const effStart = new Date(intake.startDate);
    effStart.setDate(effStart.getDate() + 1);
    effStart.setHours(0, 0, 0, 0);
    const effEnd = new Date(intake.endDate);
    effEnd.setHours(23, 59, 59, 999);
    return guests.some(g => {
      const arr = parseDateShared(g.arrivalDate);
      const dep = parseDateShared(g.departureDate);
      if (!arr || !dep) return false;
      return arr <= effEnd && dep >= effStart;
    });
  });
};
