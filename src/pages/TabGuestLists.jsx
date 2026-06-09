import { useState, useRef } from 'react';
import { useApp } from '../store';
import { parseGuestExcel, downloadGuestTemplate } from '../utils/excel';
import { computeMerge } from '../lib/mergeUtils';
import { formatDate } from '../lib/dateUtils';
import GuestListViewer from '../components/GuestListViewer';
import MergeView from '../components/MergeView';

export default function TabGuestLists() {
  const { state, dispatch } = useApp();
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [previewList, setPreviewList] = useState(null);
  const [mergeTarget, setMergeTarget] = useState(null);
  const [mergeData, setMergeData]     = useState(null);
  const [mergeDecisions, setMergeDecisions] = useState({ fields: {}, include: {} });
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError]     = useState('');
  const fileInputRef = useRef();
  const mergeFileRef = useRef();

  const handleFile = async file => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await parseGuestExcel(file);
      setPreviewList({ name: file.name.replace(/\.[^/.]+$/, ''), guests: parsed });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMergeFile = async file => {
    if (!file || !mergeTarget) return;
    setMergeLoading(true);
    setMergeError('');
    try {
      const parsed = await parseGuestExcel(file);
      const targetList = state.savedGuestLists.find(l => l.id === mergeTarget.listId);
      const result = computeMerge(targetList.guests, parsed);
      const defaultIncludes = {};
      result.newOnes.forEach(ng => { defaultIncludes[ng.id] = true; });
      setMergeData(result);
      setMergeDecisions({ fields: {}, include: defaultIncludes });
    } catch (e) {
      setMergeError(e.message);
      setMergeTarget(null);
    } finally {
      setMergeLoading(false);
      if (mergeFileRef.current) mergeFileRef.current.value = '';
    }
  };

  const handleConfirmMerge = () => {
    const targetList = state.savedGuestLists.find(l => l.id === mergeTarget?.listId);
    if (!targetList || !mergeData) return;
    const updatedGuests = targetList.guests.map(g => {
      const diff = mergeData.diffs.find(d => d.existingGuest.id === g.id);
      if (!diff) return g;
      const updates = {};
      for (const [fk, vals] of Object.entries(diff.fields)) {
        const decKey = `${g.id}__${fk}`;
        if ((mergeDecisions.fields[decKey] ?? 'new') === 'new') {
          if (fk === 'medicalRaw') { if (!Array.isArray(g.medical)) updates.medical = vals.new; }
          else updates[fk] = vals.new;
        }
      }
      return { ...g, ...updates };
    });
    const confirmedNew = mergeData.newOnes
      .filter(ng => mergeDecisions.include[ng.id] !== false)
      .map(ng => ({ ...ng, id: `g-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
    dispatch({ type: 'VERSION_GUEST_LIST', listId: mergeTarget.listId, guests: [...updatedGuests, ...confirmedNew] });
    setMergeTarget(null); setMergeData(null); setMergeDecisions({ fields: {}, include: {} });
  };

  if (previewList) {
    return (
      <GuestListViewer
        list={previewList}
        isPreview={true}
        onBack={() => setPreviewList(null)}
        onUpdateList={(next) => setPreviewList({ ...previewList, guests: next })}
        onConfirm={() => {
          dispatch({ type: 'SAVE_GUEST_LIST', name: previewList.name, guests: previewList.guests });
          setPreviewList(null);
        }}
      />
    );
  }

  if (mergeData && mergeTarget) {
    const targetList = state.savedGuestLists.find(l => l.id === mergeTarget.listId);
    return (
      <MergeView
        list={targetList}
        mergeData={mergeData}
        decisions={mergeDecisions}
        version={(targetList?.version || 1) + 1}
        onDecideField={(decKey, val) => setMergeDecisions(prev => ({ ...prev, fields: { ...prev.fields, [decKey]: val } }))}
        onToggleInclude={(guestId, val) => setMergeDecisions(prev => ({ ...prev, include: { ...prev.include, [guestId]: val } }))}
        onConfirm={handleConfirmMerge}
        onCancel={() => { setMergeTarget(null); setMergeData(null); setMergeDecisions({ fields: {}, include: {} }); }}
      />
    );
  }

  return (
    <div className="saas-tab-content">
      <div className="saas-header">
        <h1>Import Log</h1>
      </div>
      <div className="saas-pane">

        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        <input ref={mergeFileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleMergeFile(e.target.files[0])} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'var(--gray-500)', margin: 0, fontSize: 13 }}>
            Record of all imported guest lists. Manage guest data from the <strong>Groups</strong> tab.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={downloadGuestTemplate}>📄 Template</button>
            <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>➕ Import List</button>
          </div>
        </div>

        {(loading || mergeLoading) && <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</div>}
        {error && <div style={{ padding: '10px 14px', background: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: 8 }}>{error}</div>}
        {mergeError && <div style={{ padding: '10px 14px', background: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: 8 }}>{mergeError}</div>}

        {state.savedGuestLists.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--gray-400)', background: '#fff', borderRadius: 8, border: '1px dashed var(--gray-300)' }}>
            No lists imported yet. Click "Import List" to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {state.savedGuestLists.map(list => {
              const groups = [...new Set(list.guests.map(g => g.group).filter(Boolean))];
              return (
                <div key={list.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--gray-200)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)' }}>{list.name}</span>
                      {list.version > 1 && <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>v{list.version}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>
                      {list.version > 1 ? 'Updated' : 'Imported'} {formatDate(list.date)}
                      <span style={{ margin: '0 6px' }}>·</span>
                      <strong>{list.guests.length}</strong> guests · {list.guests.filter(g => g.sex === 'M').length}♂ {list.guests.filter(g => g.sex === 'F').length}♀
                      {list.history?.length > 0 && <span style={{ marginLeft: 6, color: 'var(--gray-400)' }}>· {list.history.length} prev. version{list.history.length !== 1 ? 's' : ''}</span>}
                    </div>
                    {groups.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {groups.map(g => <span key={g} style={{ fontSize: 11, background: 'var(--gray-100)', color: 'var(--gray-600)', padding: '1px 8px', borderRadius: 10 }}>{g}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      title="Import updated version"
                      onClick={() => { setMergeTarget({ listId: list.id }); mergeFileRef.current?.click(); }}
                    >
                      📥 Update
                    </button>
                    <button className="btn btn-danger-outline btn-sm" onClick={() => {
                      if (window.confirm('Delete this import? Guest data will be removed.')) dispatch({ type: 'DELETE_GUEST_LIST', id: list.id });
                    }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
