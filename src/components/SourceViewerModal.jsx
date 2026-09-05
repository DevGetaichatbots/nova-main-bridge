import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBaseUrl } from '../utils/apiConfig';
import { fetchWithAuth } from '../utils/authApi';

// TL-9.1 (Brief §24): Click-into-evidence / Source Viewer modal.
// Displays the recorded page of the source schedule with the recorded
// bounding box highlighted (TL-1.2 geometry).
// Renders outside the sandboxed iframe to preserve full auth context.
// Nova app supports both English and Danish via useTranslation.

const SourceViewerModal = ({
  isOpen,
  onClose,
  comparisonId,
  scheduleRole = 'new',
  pageNumber = 1,
  boundingBox = null,
  filename = '',
}) => {
  const { t, i18n } = useTranslation();
  const isDanish = i18n.language?.startsWith('da');

  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const roleLabel = scheduleRole === 'old'
    ? (isDanish ? 'Gammel tidsplan' : 'Old Schedule')
    : (isDanish ? 'Ny tidsplan' : 'New Schedule');

  const pageLabel = isDanish ? `Side ${pageNumber}` : `Page ${pageNumber}`;

  useEffect(() => {
    if (!isOpen || !comparisonId || !pageNumber) {
      setImageUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    let objectUrl = null;

    const fetchPageImage = async () => {
      setIsLoading(true);
      setError(null);
      setImageUrl(null);

      try {
        const apiBase = getApiBaseUrl();
        let endpoint = `${apiBase}/api/schedule/comparisons/${comparisonId}/source/${scheduleRole}?page=${pageNumber}`;
        if (boundingBox && Array.isArray(boundingBox) && boundingBox.length >= 4) {
          endpoint += `&bbox=${encodeURIComponent(JSON.stringify(boundingBox))}`;
        }

        const response = await fetchWithAuth(endpoint);
        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `Could not load source document (status ${response.status})`);
        }

        const blob = await response.blob();
        if (!isMounted) return;

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Error loading source document page.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchPageImage();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, comparisonId, scheduleRole, pageNumber, boundingBox]);

  if (!isOpen) return null;

  const handleDownloadFullDoc = () => {
    const apiBase = getApiBaseUrl();
    const downloadUrl = `${apiBase}/api/schedule/comparisons/${comparisonId}/source/${scheduleRole}`;
    window.open(downloadUrl, '_blank');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: '#0284c7',
                  backgroundColor: '#e0f2fe',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                {isDanish ? 'KILDEVERIFICERING' : 'SOURCE VERIFICATION'}
              </span>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#111827' }}>
                {roleLabel} — {pageLabel}
              </h3>
            </div>
            {filename && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
                {filename}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            aria-label="Close source viewer"
          >
            ✕
          </button>
        </div>

        {/* Content area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f1f5f9',
            minHeight: '400px',
          }}
        >
          {isLoading && (
            <div style={{ textAlign: 'center', color: '#0284c7', fontWeight: 600 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #bae6fd',
                  borderTopColor: '#0284c7',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px',
                }}
              />
              {isDanish ? 'Indlæser kildedokument og fremhæver region...' : 'Loading source document and highlighting region...'}
            </div>
          )}

          {error && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '16px 20px',
                color: '#991b1b',
                maxWidth: '500px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                {isDanish ? 'Kildedokument ikke tilgængeligt' : 'Source Document Unavailable'}
              </div>
              <div style={{ fontSize: '13px' }}>{error}</div>
            </div>
          )}

          {!isLoading && !error && imageUrl && (
            <div
              style={{
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                overflow: 'hidden',
                maxWidth: '100%',
              }}
            >
              <img
                src={imageUrl}
                alt={`Source document ${roleLabel} page ${pageNumber}`}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto',
                  maxHeight: '72vh',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {isDanish
              ? 'Markeret område viser den udtrukne række fra kildedokumentet.'
              : 'Highlighted region shows the extracted row from the source document.'}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDownloadFullDoc}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                color: '#374151',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isDanish ? 'Download kildedokument' : 'Download source document'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isDanish ? 'Luk' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SourceViewerModal;
