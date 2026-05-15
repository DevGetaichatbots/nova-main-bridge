import { useState, useEffect, useCallback } from 'react';

export const useSessionUploadState = (sessionId) => {
  const [uploadState, setUploadState] = useState({
    firstFileUploaded: false,
    secondFileUploaded: false,
    firstFileTimestamp: null,
    secondFileTimestamp: null,
  });

  const storageKey = sessionId ? `fileUploadState_${sessionId}` : null;

  useEffect(() => {
    if (!sessionId) {
      setUploadState({
        firstFileUploaded: false,
        secondFileUploaded: false,
        firstFileTimestamp: null,
        secondFileTimestamp: null,
      });
      return;
    }

    const loadState = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log(`📥 Loaded upload state for session ${sessionId}:`, parsed);
          setUploadState(parsed);
        } else {
          console.log(`📋 No saved upload state for session ${sessionId}, starting fresh`);
          setUploadState({
            firstFileUploaded: false,
            secondFileUploaded: false,
            firstFileTimestamp: null,
            secondFileTimestamp: null,
          });
        }
      } catch (error) {
        console.error('Error loading upload state:', error);
        setUploadState({
          firstFileUploaded: false,
          secondFileUploaded: false,
          firstFileTimestamp: null,
          secondFileTimestamp: null,
        });
      }
    };

    // Initial load
    loadState();

    // CRITICAL FIX: Listen for cross-component updates
    const handleStorageUpdate = (event) => {
      // Handle both custom event and native storage event
      if (event.detail?.sessionId === sessionId || event.key === storageKey) {
        console.log(`🔄 Upload state changed for session ${sessionId}, reloading...`);
        loadState();
      }
    };

    const handleCustomEvent = (event) => {
      if (event.detail?.sessionId === sessionId) {
        console.log(`🔄 Custom event: Upload state changed for session ${sessionId}, reloading...`);
        loadState();
      }
    };

    // Subscribe to both native storage event (cross-tab) and custom event (same-tab)
    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('sessionFilesUpdated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('sessionFilesUpdated', handleCustomEvent);
    };
  }, [sessionId, storageKey]);

  const saveState = useCallback((newState) => {
    if (!sessionId) return;

    const stateToSave = {
      ...uploadState,
      ...newState,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
      console.log(`💾 Saved upload state for session ${sessionId}:`, stateToSave);
      
      setUploadState(stateToSave);

      window.dispatchEvent(new CustomEvent('sessionFilesUpdated', {
        detail: { sessionId, uploadState: stateToSave }
      }));
      
      console.log(`📢 Dispatched sessionFilesUpdated event`);
    } catch (error) {
      console.error('Error saving upload state:', error);
    }
  }, [sessionId, storageKey, uploadState]);

  const markFirstFileUploaded = useCallback(() => {
    const newState = {
      firstFileUploaded: true,
      firstFileTimestamp: Date.now(),
    };
    saveState(newState);
    console.log(`✅ First file marked as uploaded`);
  }, [saveState]);

  const markSecondFileUploaded = useCallback(() => {
    const newState = {
      secondFileUploaded: true,
      secondFileTimestamp: Date.now(),
    };
    saveState(newState);
    console.log(`✅ Second file marked as uploaded`);
  }, [saveState]);

  const resetState = useCallback(() => {
    if (!sessionId) return;

    const freshState = {
      firstFileUploaded: false,
      secondFileUploaded: false,
      firstFileTimestamp: null,
      secondFileTimestamp: null,
    };

    try {
      localStorage.removeItem(storageKey);
      setUploadState(freshState);
      console.log(`🔄 Reset upload state for session ${sessionId}`);
      
      window.dispatchEvent(new CustomEvent('sessionFilesUpdated', {
        detail: { sessionId, uploadState: freshState }
      }));
    } catch (error) {
      console.error('Error resetting upload state:', error);
    }
  }, [sessionId, storageKey]);

  return {
    uploadState,
    markFirstFileUploaded,
    markSecondFileUploaded,
    resetState,
    isFirstFileUploaded: uploadState.firstFileUploaded,
    isSecondFileUploaded: uploadState.secondFileUploaded,
  };
};
