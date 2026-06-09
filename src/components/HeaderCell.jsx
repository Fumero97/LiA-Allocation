export default function HeaderCell({ col, label, hasFilter = false, filterType = 'text', options = [], filterKey, sortKey, sortDir, colFilters, onSort, onFilter }) {
  const fKey = filterKey || col;
  return (
    <th>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          onClick={() => onSort(col)}
          style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{label}</span>
          <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>
            {sortKey === col ? (sortDir > 0 ? '↑' : '↓') : '↕'}
          </span>
        </div>
        {hasFilter && (
          filterType === 'select' ? (
            <select
              className="filter-select mini"
              style={{ fontSize: 10, padding: '2px 4px', height: 22 }}
              value={colFilters[fKey] || 'all'}
              onChange={e => onFilter(fKey, e.target.value)}
            >
              <option value="all">Tutti</option>
              {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
            </select>
          ) : (
            <input
              className="filter-search-input mini"
              style={{ fontSize: 10, padding: '2px 6px', height: 22 }}
              placeholder="Filtra..."
              value={colFilters[fKey] || ''}
              onChange={e => onFilter(fKey, e.target.value)}
            />
          )
        )}
      </div>
    </th>
  );
}
