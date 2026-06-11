export const MERGE_DIFF_FIELDS = [
  { key: 'group',            label: 'Group' },
  { key: 'externalId',       label: 'ID' },
  { key: 'name',             label: 'Name' },
  { key: 'surname',          label: 'Surname' },
  { key: 'fullName',         label: 'Full Name' },
  { key: 'sex',              label: 'Sex' },
  { key: 'age',              label: 'Age' },
  { key: 'dob',              label: 'Date of Birth' },
  { key: 'medicalRaw',       label: 'Medical/Allergies' },
  { key: 'privateNotes',     label: 'Private Notes' },
  { key: 'arrivalAirport',   label: 'Arrival Airport' },
  { key: 'arrivalTime',      label: 'Arrival Time' },
  { key: 'arrivalDate',      label: 'Arrival Date' },
  { key: 'departureDate',    label: 'Departure Date' },
  { key: 'departureTime',    label: 'Departure Time' },
  { key: 'departureAirport', label: 'Departure Airport' },
];

export function computeMerge(existingGuests, newGuests) {
  const diffs = [];
  const newOnes = [];
  const matchedIds = new Set();

  for (const ng of newGuests) {
    let existing = null;
    if (ng.externalId) {
      existing = existingGuests.find(g => g.externalId && g.externalId.toLowerCase() === ng.externalId.toLowerCase());
    }
    if (!existing && ng.fullName) {
      existing = existingGuests.find(g => !matchedIds.has(g.id) && g.fullName && g.fullName.toLowerCase() === ng.fullName.toLowerCase());
    }
    if (!existing) {
      existing = existingGuests.find(g =>
        !matchedIds.has(g.id) &&
        g.name?.toLowerCase() === ng.name?.toLowerCase() &&
        g.surname?.toLowerCase() === ng.surname?.toLowerCase()
      );
    }

    if (existing && !matchedIds.has(existing.id)) {
      matchedIds.add(existing.id);
      const fieldDiffs = {};
      for (const { key } of MERGE_DIFF_FIELDS) {
        let oldVal, newVal;
        if (key === 'medicalRaw') {
          oldVal = Array.isArray(existing.medical) ? existing.medical.join(', ') : (existing.medical || '');
          newVal = String(ng.medical || '');
        } else {
          oldVal = String(existing[key] ?? '');
          newVal = String(ng[key] ?? '');
        }
        if (oldVal !== newVal) fieldDiffs[key] = { old: oldVal, new: newVal };
      }
      if (Object.keys(fieldDiffs).length > 0) {
        diffs.push({ existingGuest: existing, fields: fieldDiffs, newGuest: ng });
      }
    } else if (!existing) {
      newOnes.push(ng);
    }
  }

  return { diffs, newOnes };
}
