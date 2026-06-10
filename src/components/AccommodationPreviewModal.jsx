export default function AccommodationPreviewModal({ accommodation, onConfirm, onCancel }) {
  const totalCorridors = accommodation.floors.reduce((s, f) => s + f.corridors.length, 0);
  const totalRooms = accommodation.floors.reduce(
    (s, f) => s + f.corridors.reduce((cs, c) => cs + c.rooms.length, 0), 0
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gray-200)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Import preview
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>
            {accommodation.name || 'Unnamed structure'}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
            {[
              { label: 'Floors',    value: accommodation.floors.length },
              { label: 'Corridors', value: totalCorridors },
              { label: 'Rooms',     value: totalRooms },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center', background: 'var(--gray-50)', borderRadius: 8, padding: '6px 14px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-600)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {accommodation.floors.map((floor) => {
            const floorRooms = floor.corridors.reduce((s, c) => s + c.rooms.length, 0);
            return (
              <div key={floor.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, borderRadius: 6,
                    background: 'var(--primary-600)', color: '#fff',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {floor.number}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
                    {floor.name || `Floor ${floor.number}`}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 'auto' }}>
                    {floorRooms} rooms
                  </span>
                </div>
                <div style={{ marginLeft: 34, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {floor.corridors.map((corridor) => (
                    <div key={corridor.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 10px', background: 'var(--gray-50)',
                      borderRadius: 6, fontSize: 12,
                    }}>
                      <span style={{ color: 'var(--gray-600)', fontWeight: 500 }}>{corridor.name}</span>
                      <span style={{ color: 'var(--gray-400)' }}>
                        {corridor.rooms.length} room{corridor.rooms.length !== 1 ? 's' : ''}
                        {corridor.rooms.length > 0 && (
                          <span style={{ marginLeft: 6, color: 'var(--gray-300)' }}>
                            ({corridor.rooms[0].number}–{corridor.rooms[corridor.rooms.length - 1].number})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Save Structure</button>
        </div>

      </div>
    </div>
  );
}
