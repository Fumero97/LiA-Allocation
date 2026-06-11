import * as XLSX from 'xlsx';

// Column headers in exact order
const TEMPLATE_HEADERS = [
  'Group', 'ID', 'Forename', 'Surname', 'Full Name',
  'Gender', 'Age', 'DOB',
  'Medical/Allergies', 'Private notes',
  'Arrival Airport', 'Arrival Time', 'Arrival Date',
  'Departure Date', 'Departure Time', 'Departure Airport',
];

function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function normalizeGender(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.startsWith('f')) return 'F';
  return 'M';
}

/**
 * Convert any Excel date cell value to "DD/MM/YYYY" string.
 * Handles: JS Date objects (from cellDates:true), Excel serial numbers,
 * and already-formatted strings in common formats.
 */
function parseDate(raw) {
  if (!raw && raw !== 0) return '';

  // JS Date — xlsx creates local-midnight dates, so use LOCAL methods
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '';
    const d = String(raw.getDate()).padStart(2, '0');
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const y = raw.getFullYear();
    return `${d}/${m}/${y}`;
  }

  // Excel serial number (integer or float — date part only)
  // Epoch: Dec 30 1899 UTC (accounts for Excel's 1900 leap-year bug)
  if (typeof raw === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * 86400000);
    if (isNaN(date.getTime())) return String(raw);
    const d = String(date.getUTCDate()).padStart(2, '0');
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const y = date.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }

  // String: normalise common formats → DD/MM/YYYY
  const s = String(raw).trim();
  if (!s) return '';

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
  }

  // YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD (ISO-ish)
  const isoMatch = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
  }

  // "DD Mon YYYY" or "DD Month YYYY" (e.g. "30 Jun 2025", "30 June 2025")
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const monMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (monMatch) {
    const [, d, mon, y] = monMatch;
    const mNum = MONTHS[mon.toLowerCase().slice(0,3)];
    if (mNum) return `${d.padStart(2,'0')}/${String(mNum).padStart(2,'0')}/${y}`;
  }

  // Fallback: native Date parsing
  // ISO strings (yyyy-mm-dd) are already caught by isoMatch above.
  // Remaining formats (e.g. "30 Jun 2025") are parsed as LOCAL time by browsers,
  // so use local methods to avoid the UTC-vs-local off-by-one in UTC+ timezones.
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return s;
}

/**
 * Convert any Excel time cell value to "HH:MM" string.
 * Handles: JS Date objects, Excel time fractions (0–1), "HH:MM" strings.
 */
function parseTime(raw) {
  if (!raw && raw !== 0) return '';

  // JS Date — kept for safety
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '';
    const h = String(raw.getUTCHours()).padStart(2, '0');
    const min = String(raw.getUTCMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }

  // Excel time fraction (0 to 1, where 1 = 24h); also handles datetime serials
  if (typeof raw === 'number') {
    const fraction = raw % 1; // strip date part if datetime serial
    const totalMinutes = Math.round(fraction * 1440);
    const h = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const min = String(totalMinutes % 60).padStart(2, '0');
    return `${h}:${min}`;
  }

  // String: already HH:MM or HH:MM:SS
  const s = String(raw).trim();
  const timeMatch = s.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    return `${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}`;
  }

  return s;
}

/** Download a pre-filled Excel template */
export function downloadGuestTemplate() {
  const ex1 = ['Group A', 'ST001', 'John',  'Smith', 'John Smith',  'Male',   16, '15/03/2009', '',            '',              'LHR', '14:00', '01/07/2025', '14/07/2025', '10:00', 'LHR'];
  const ex2 = ['Group A', 'ST002', 'Jane',  'Doe',   'Jane Doe',   'Female', 17, '22/07/2008', 'Nut allergy', '',              'LHR', '15:30', '01/07/2025', '14/07/2025', '10:00', 'LHR'];
  const ex3 = ['Group B', 'ST003', 'Marco', 'Rossi', 'Marco Rossi','Male',   18, '05/11/2007', '',            'Top bunk pref', 'FCO', '12:00', '02/07/2025', '15/07/2025', '11:00', 'FCO'];

  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ex1, ex2, ex3]);
  ws['!cols'] = [10, 8, 12, 12, 18, 8, 6, 12, 20, 18, 14, 12, 14, 14, 12, 14].map(w => ({ wch: w }));

  // Style header row bold (basic)
  TEMPLATE_HEADERS.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cell]) return;
    ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E0E7FF' } } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Guests');
  XLSX.writeFile(wb, 'guest-template.xlsx');
}

/** Parse an uploaded Excel file — matches columns by header name (case-insensitive) */
export function parseGuestExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // raw:false returns the cell's formatted display string (.w) when available,
        // which preserves the date format as the user sees it in Excel (e.g. "11/01/2010")
        // and avoids the MM/DD vs DD/MM ambiguity introduced by Excel's locale.
        // Cells without a format fall back to their raw value (.v).
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

        if (rows.length < 2) {
          resolve([]);
          return;
        }

        // Build column-name → index map from the header row
        // Replace line breaks with spaces so "Arrival\nAirport" matches "arrival airport"
        const headerRow = rows[0].map(h => String(h).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim());
        const col = name => headerRow.indexOf(name.toLowerCase().trim());

        // Try multiple column name variants, return value from first match found
        const colFirst = (...names) => {
          for (const name of names) {
            const idx = headerRow.indexOf(name.toLowerCase().trim());
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim()));

        const guests = dataRows.map((row, idx) => {
          const forename = titleCase(String(row[colFirst('forename', 'nome', 'first name', 'firstname', 'name')] || '').trim());
          const surname  = titleCase(String(row[colFirst('surname', 'cognome', 'last name', 'lastname')] || '').trim());
          const fullName = titleCase(String(row[colFirst('full name', 'fullname', 'nome completo')] || '').trim()) || `${forename} ${surname}`.trim();

          return {
            id: `g-${Date.now()}-${idx}`,
            externalId:      String(row[colFirst('id', 'external id', 'externalid', 'codice')] || '').trim(),
            group:           String(row[colFirst('group', 'gruppo', 'turno')] || '').trim() || 'No Group',
            name:            forename,
            surname:         surname,
            fullName,
            sex:             normalizeGender(row[colFirst('gender', 'sex', 'sesso', 'genere')]),
            age:             parseInt(row[colFirst('age', 'età', 'eta')]) || 0,
            dob:             parseDate(row[colFirst('dob', 'date of birth', 'birth date', 'data nascita', 'data di nascita', 'nascita')]),
            medical:         String(row[colFirst('medical/allergies', 'medical', 'allergies', 'allergie', 'medico', 'medical notes', 'note mediche')] || '').trim(),
            privateNotes:    String(row[colFirst('private notes', 'notes', 'note', 'note private', 'private')] || '').trim(),
            arrivalAirport:  String(row[colFirst('arrival airport', 'arrivalairport', 'airport arrival', 'arr airport', 'arr. airport', 'arrairport', 'aeroporto arrivo', 'aeroporto di arrivo', 'flight in', 'volo arrivo', 'aeroporto')] || '').trim(),
            arrivalTime:     parseTime(row[colFirst('arrival time', 'time arrival', 'arr time', 'ora arrivo', 'arr. time')]) || '',
            arrivalDate:     parseDate(row[colFirst('arrival date', 'date arrival', 'arr date', 'data arrivo', 'data di arrivo', 'arrivo', 'arr. date', 'arrival')]),
            departureDate:   parseDate(row[colFirst('departure date', 'date departure', 'dep date', 'data partenza', 'data di partenza', 'partenza', 'dep. date', 'departure')]),
            departureTime:   parseTime(row[colFirst('departure time', 'time departure', 'dep time', 'ora partenza', 'dep. time')]) || '',
            departureAirport:String(row[colFirst('departure airport', 'departureairport', 'airport departure', 'dep airport', 'dep. airport', 'depairport', 'aeroporto partenza', 'aeroporto di partenza', 'flight out', 'volo partenza')] || '').trim(),
            roomId: null,
          };
        });

        resolve(guests);
      } catch (err) {
        reject(new Error('Error reading Excel file:' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  });
}

/** Export a guest list to Excel in the same format as the import template */
export function exportGuestList(guests, listName = 'guest-list') {
  const rows = guests.map(g => [
    g.group || '',
    g.externalId || '',
    g.name || '',
    g.surname || '',
    g.fullName || `${g.name} ${g.surname}`.trim(),
    g.sex === 'F' ? 'Female' : 'Male',
    g.age || '',
    g.dob || '',
    Array.isArray(g.medical) ? g.medical.join(', ') : (g.medical || ''),
    g.privateNotes || '',
    g.arrivalAirport || '',
    g.arrivalTime || '',
    g.arrivalDate || '',
    g.departureDate || '',
    g.departureTime || '',
    g.departureAirport || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
  ws['!cols'] = [10, 8, 12, 12, 18, 8, 6, 12, 20, 18, 14, 12, 14, 14, 12, 14].map(w => ({ wch: w }));
  TEMPLATE_HEADERS.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cell]) return;
    ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E0E7FF' } } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Guests');
  const safeName = listName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'guest-list';
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}

// ─── Accommodation structure import/export ────────────────────────────────────

const ACCOMMODATION_TEMPLATE_HEADERS = [
  'Building Name', 'Floor', 'Corridor', 'Room Number', 'Capacity', 'Type', 'Status',
];

/** Download a pre-filled Excel template for accommodation structure import */
export function downloadAccommodationTemplate() {
  const rows = [
    ['Hotel Bel Soggiorno', 1, 'Ala Nord', '101', 3, 'standard', 'available'],
    ['Hotel Bel Soggiorno', 1, 'Ala Nord', '102', 3, 'standard', 'available'],
    ['Hotel Bel Soggiorno', 1, 'Ala Nord', '103', 2, 'double',   'available'],
    ['Hotel Bel Soggiorno', 2, 'Ala Sud',  '201', 4, 'quad',     'available'],
    ['Hotel Bel Soggiorno', 2, 'Ala Sud',  '202', 1, 'single',   'unavailable'],
    ['Hotel Bel Soggiorno', 3, 'Ala Est',  '301', 3, 'standard', 'available'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([ACCOMMODATION_TEMPLATE_HEADERS, ...rows]);
  ws['!cols'] = [22, 8, 16, 14, 10, 12, 14].map(w => ({ wch: w }));

  ACCOMMODATION_TEMPLATE_HEADERS.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cell]) return;
    ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: 'D1FAE5' } } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Structure');
  XLSX.writeFile(wb, 'accommodation-template.xlsx');
}

function generateRoomId() {
  return 'rm-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Parse an uploaded Excel file describing a building structure.
 * Returns an accommodation object: { name, floors: [{ id, number, corridors: [{ id, name, rooms }] }] }
 */
export function parseAccommodationExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

        if (rows.length < 2) {
          reject(new Error('The file is empty or missing the header row.'));
          return;
        }

        const headerRow = rows[0].map(h => String(h).toLowerCase().trim());
        const col = (...names) => {
          for (const name of names) {
            const idx = headerRow.indexOf(name.toLowerCase().trim());
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));

        let buildingName = '';
        const floorMap = new Map(); // floorNumber → Map(corridorName → rooms[])

        for (const row of dataRows) {
          const rawBuilding  = String(row[col('building name', 'building', 'struttura', 'nome struttura', 'hotel')] || '').trim();
          const rawFloor     = String(row[col('floor', 'piano')] || '').trim();
          const rawCorridor  = String(row[col('corridor', 'corridoio', 'ala', 'wing')] || '').trim();
          const rawRoom      = String(row[col('room number', 'room', 'stanza', 'numero stanza', 'camera')] || '').trim();
          const rawCapacity  = parseInt(row[col('capacity', 'capacità', 'posti', 'beds')]) || 2;
          const rawType      = String(row[col('type', 'tipo')] || '').trim().toLowerCase();
          const rawStatus    = String(row[col('status', 'stato', 'disponibilità')] || '').trim().toLowerCase();

          if (!rawRoom) continue;
          if (!buildingName && rawBuilding) buildingName = rawBuilding;

          const floorNum = String(rawFloor || '1').trim();
          const corridorName = rawCorridor || `Floor ${floorNum}`;

          const validTypes = ['standard', 'single', 'double', 'triple', 'quad', 'suite'];
          const type = validTypes.includes(rawType)
            ? rawType
            : rawCapacity === 1 ? 'single' : rawCapacity === 2 ? 'double' : 'standard';

          const status = rawStatus === 'unavailable' ? 'unavailable' : 'available';

          if (!floorMap.has(floorNum)) floorMap.set(floorNum, new Map());
          const corridorMap = floorMap.get(floorNum);
          if (!corridorMap.has(corridorName)) corridorMap.set(corridorName, []);
          corridorMap.get(corridorName).push({
            id: generateRoomId(),
            number: rawRoom,
            capacity: rawCapacity,
            type,
            status,
            unavailableUntil: null,
          });
        }

        if (floorMap.size === 0) {
          reject(new Error('No rooms found. Please check the column headers.'));
          return;
        }

        const floors = [...floorMap.entries()]
          .map(([floorNum, corridorMap]) => ({
            id: 'fl-' + Math.random().toString(36).slice(2, 10),
            number: floorNum,
            corridors: [...corridorMap.entries()].map(([name, rooms]) => ({
              id: 'co-' + Math.random().toString(36).slice(2, 10),
              name,
              rooms,
            })),
          }));

        resolve({ name: buildingName || 'Imported structure', floors });
      } catch (err) {
        reject(new Error('Error reading Excel file:' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  });
}

/** Export allocation results to Excel — Building and Room as first columns */
export function exportAllocation(guests, accommodation) {
  const wb = XLSX.utils.book_new();

  // Build room lookup
  const roomLookup = {};
  accommodation.floors.forEach(floor => {
    floor.corridors.forEach(corridor => {
      corridor.rooms.forEach(room => {
        roomLookup[room.id] = {
          number:   room.number,
          floor:    floor.number,
          corridor: corridor.name,
        };
      });
    });
  });

  const sortedGuests = [...guests].sort((a, b) => {
    const ra = a.roomId ? roomLookup[a.roomId] : null;
    const rb = b.roomId ? roomLookup[b.roomId] : null;
    if (!ra && !rb) return (a.surname || '').localeCompare(b.surname || '');
    if (!ra) return 1;
    if (!rb) return -1;
    if (ra.floor !== rb.floor) return ra.floor - rb.floor;
    if (ra.corridor !== rb.corridor) return ra.corridor.localeCompare(rb.corridor);
    return String(ra.number).localeCompare(String(rb.number));
  });

  const rows = sortedGuests.map(g => {
    const r = g.roomId ? roomLookup[g.roomId] : null;
    return {
      'Building':          accommodation.name || '',
      'Room':              r?.number || '',
      'Group':             g.group,
      'ID':                g.externalId || '',
      'Forename':          g.name,
      'Surname':           g.surname,
      'Full Name':         g.fullName || `${g.name} ${g.surname}`.trim(),
      'Gender':            g.sex === 'M' ? 'Male' : 'Female',
      'Age':               g.age,
      'DOB':               g.dob || '',
      'Medical/Allergies': Array.isArray(g.medical) ? g.medical.join(', ') : (g.medical || ''),
      'Private notes':     g.privateNotes || '',
      'Arrival Airport':   g.arrivalAirport || '',
      'Arrival Time':      g.arrivalTime,
      'Arrival Date':      g.arrivalDate,
      'Departure Date':    g.departureDate,
      'Departure Time':    g.departureTime,
      'Departure Airport': g.departureAirport || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [16,8,10,8,12,12,18,8,6,12,20,18,14,12,14,14,12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Allocation List');

  XLSX.writeFile(wb, `allocation-${new Date().toISOString().split('T')[0]}.xlsx`);
}
