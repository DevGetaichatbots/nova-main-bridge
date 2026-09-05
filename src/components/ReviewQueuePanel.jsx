import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { comparisonService } from '../services/comparisonService';

// TL-8.2 (brief §25/§26): the review queue UI. Renders in the PARENT app,
// never inside the dashboard's sandboxed iframe (`sandbox="allow-scripts"`,
// no `allow-same-origin`) — it needs the parent app's own auth context to
// call the resolve/reopen endpoints, which the iframe cannot reach.

const CATEGORY_LABELS = {
  en: {
    low_confidence_id: 'Low-confidence ID',
    uncertain_match: 'Uncertain match',
    unreadable_date: 'Unreadable date',
    conflicting_value: 'Conflicting value',
  },
  da: {
    low_confidence_id: 'Lav-sikkerhed ID',
    uncertain_match: 'Usikkert match',
    unreadable_date: 'Ulæselig dato',
    conflicting_value: 'Værdikonflikt',
  },
};

const getConsequenceText = (item, chosenOptionId, isDa) => {
  if (chosenOptionId === 'no_match') {
    return isDa
      ? 'Aktiviteten markeres som ny uden modpart i den tidligere tidsplan og medtages ikke i bekræftede sammenligningsresultater.'
      : 'This activity will be treated as new with no counterpart in the prior schedule and excluded from confirmed comparison results.';
  }
  if (item.category === 'uncertain_match') {
    const opt = (item.candidate_options || []).find((o) => o.option_id === chosenOptionId);
    const target = opt?.activity_id || opt?.label || chosenOptionId;
    return isDa
      ? `Aktiviteten matches med ${target} og medtages i de bekræftede sammenligningsresultater.`
      : `This activity will be matched with ${target} and included in confirmed comparison results.`;
  }
  if (item.category === 'low_confidence_id') {
    return isDa
      ? 'Aktivitetens ID bekræftes og anvendes som pålidelig reference i fremtidige analyser.'
      : 'This activity ID will be marked as confirmed and used as a reliable reference.';
  }
  if (item.category === 'unreadable_date') {
    return isDa
      ? 'Datoen bekræftes og markeres som verificeret af brugeren.'
      : 'This date will be marked as user-verified in subsequent analyses.';
  }
  if (item.category === 'conflicting_value') {
    return isDa
      ? 'Værdikonflikten markeres som løst med den valgte værdi.'
      : 'The value conflict will be resolved with the selected value.';
  }
  return isDa
    ? 'Beslutningen gemmes som en bekræftet rettelse.'
    : 'The resolution will be saved as a confirmed correction.';
};

const ReviewQueuePanel = ({ comparisonId, isOpen, onClose, onResolved }) => {
  const { i18n } = useTranslation();
  const isDa = i18n?.language?.startsWith('da') || false;
  const langKey = isDa ? 'da' : 'en';

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyItemId, setBusyItemId] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});

  const load = useCallback(async () => {
    if (!comparisonId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await comparisonService.listReviewQueue(comparisonId);
      if (data.success) setItems(data.items || []);
    } catch (err) {
      setError(err.message || (isDa ? 'Kunne ikke indlæse gennemgangskøen.' : 'Could not load the review queue.'));
    } finally {
      setIsLoading(false);
    }
  }, [comparisonId, isDa]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const handleResolve = async (itemId, chosenOptionId) => {
    setBusyItemId(itemId);
    try {
      const data = await comparisonService.resolveReviewItem(
        comparisonId, itemId, chosenOptionId, noteDrafts[itemId] || '',
      );
      if (data.success) {
        setSelectedOptions((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        await load();
        onResolved?.();
      } else {
        setError(data.error || (isDa ? 'Kunne ikke løse dette element.' : 'Could not resolve this item.'));
      }
    } catch (err) {
      setError(err.message || (isDa ? 'Kunne ikke løse dette element.' : 'Could not resolve this item.'));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleReopen = async (itemId) => {
    setBusyItemId(itemId);
    try {
      const data = await comparisonService.reopenReviewItem(comparisonId, itemId, noteDrafts[itemId] || '');
      if (data.success) {
        await load();
        onResolved?.();
      } else {
        setError(data.error || (isDa ? 'Kunne ikke genåbne dette element.' : 'Could not reopen this item.'));
      }
    } catch (err) {
      setError(err.message || (isDa ? 'Kunne ikke genåbne dette element.' : 'Could not reopen this item.'));
    } finally {
      setBusyItemId(null);
    }
  };

  if (!isOpen) return null;

  const pending = items.filter((it) => it.state !== 'resolved');
  const resolved = items.filter((it) => it.state === 'resolved');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isDa ? 'Gennemgang påkrævet' : 'Review required'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isDa
                ? `${pending.length} ${pending.length === 1 ? 'element kræver' : 'elementer kræver'} en beslutning`
                : `${pending.length} item${pending.length === 1 ? '' : 's'} need${pending.length === 1 ? 's' : ''} a decision`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}
          {isLoading && <p className="text-sm text-slate-400">{isDa ? 'Indlæser…' : 'Loading…'}</p>}
          {!isLoading && items.length === 0 && (
            <p className="text-sm text-slate-400">
              {isDa
                ? 'Intet kræver gennemgang — alle aktiviteter blev bekræftet.'
                : 'Nothing needs review — every activity was confirmed cleanly.'}
            </p>
          )}

          {pending.map((item) => {
            const currentChosen = selectedOptions[item.item_id];
            return (
              <div key={item.item_id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {CATEGORY_LABELS[langKey]?.[item.category] || item.category}
                  </span>
                  {item.detail?.activity_name && (
                    <span className="text-sm font-semibold text-slate-800">{item.detail.activity_name}</span>
                  )}
                </div>
                <p className="text-sm text-slate-700 mb-3">{item.evidence}</p>

                <div className="flex flex-wrap gap-2 mb-2">
                  {(item.candidate_options || []).map((opt) => {
                    const isSelected = currentChosen === opt.option_id;
                    return (
                      <button
                        key={opt.option_id}
                        type="button"
                        disabled={busyItemId === item.item_id}
                        onClick={() => setSelectedOptions((prev) => ({
                          ...prev,
                          [item.item_id]: isSelected ? undefined : opt.option_id,
                        }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-[#1eb5ee] bg-[#1eb5ee] text-white shadow-sm'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-[#1eb5ee] hover:text-[#1eb5ee]'
                        } disabled:opacity-50`}
                      >
                        {opt.label === 'No match' && isDa ? 'Intet match' : opt.label}
                        {opt.evidence ? (
                          <span className={isSelected ? 'text-white/80' : 'text-slate-400'}> · {opt.evidence}</span>
                        ) : null}
                      </button>
                    );
                  })}
                  {(item.candidate_options || []).length === 0 && (
                    <button
                      type="button"
                      disabled={busyItemId === item.item_id}
                      onClick={() => setSelectedOptions((prev) => ({
                        ...prev,
                        [item.item_id]: currentChosen === 'no_match' ? undefined : 'no_match',
                      }))}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                        currentChosen === 'no_match'
                          ? 'border-[#1eb5ee] bg-[#1eb5ee] text-white shadow-sm'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-[#1eb5ee] hover:text-[#1eb5ee]'
                      } disabled:opacity-50`}
                    >
                      {isDa ? 'Bekræft som læst' : 'Confirm as read'}
                    </button>
                  )}
                </div>

                {currentChosen && (
                  <div className="mt-3 mb-3 p-3 rounded-xl bg-white border border-amber-300 shadow-sm text-xs text-slate-800">
                    <p className="font-semibold text-slate-900 mb-1">
                      {isDa ? 'Konsekvens af beslutning:' : 'Consequence of resolution:'}
                    </p>
                    <p className="text-slate-600 mb-2">{getConsequenceText(item, currentChosen, isDa)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyItemId === item.item_id}
                        onClick={() => handleResolve(item.item_id, currentChosen)}
                        className="px-3 py-1.5 rounded-lg bg-[#1eb5ee] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                      >
                        {isDa ? 'Bekræft valg' : 'Confirm resolution'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedOptions((prev) => {
                          const next = { ...prev };
                          delete next[item.item_id];
                          return next;
                        })}
                        className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                      >
                        {isDa ? 'Annuller' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}

                <input
                  type="text"
                  placeholder={isDa ? 'Valgfri note…' : 'Optional note…'}
                  value={noteDrafts[item.item_id] || ''}
                  onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.item_id]: e.target.value }))}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#1eb5ee]"
                />
              </div>
            );
          })}

          {resolved.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                {isDa ? 'Løst' : 'Resolved'}
              </p>
              <div className="space-y-2">
                {resolved.map((item) => (
                  <div key={item.item_id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs text-slate-500 truncate pr-2">{item.evidence}</span>
                    <button
                      disabled={busyItemId === item.item_id}
                      onClick={() => handleReopen(item.item_id)}
                      className="text-xs font-medium text-slate-500 hover:text-[#1eb5ee] flex-shrink-0"
                    >
                      {isDa ? 'Genåbn' : 'Reopen'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewQueuePanel;
