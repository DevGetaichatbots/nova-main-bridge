import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getWithAuth, deleteWithAuth, putWithAuth } from '../utils/authApi';

const sessionCache = {
  sessions: [],
  hasFetched: false,
  isFetching: false,
  lastUserId: null,
  lastRefreshTrigger: 0,
};

const MiniSpinner = ({ size = 12, color = 'currentColor' }) => (
  <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.25" />
    <path d="M12 2a10 10 0 019.95 9" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const SessionSkeleton = () => (
  <div className="p-1.5 space-y-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="rounded-lg p-2 animate-pulse">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-2.5 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const ChatHistorySidebar = ({
  isOpen,
  onToggle,
  onNewChat,
  onSelectSession,
  activeSessionId,
  user,
  isReadOnly = false,
  sidebarWidth,
  onWidthChange,
  isResizing,
  onResizeStart,
  refreshTrigger = 0,
  onSessionsLoaded,
  updatedSessionInfo = null,
  forceUpdateKey = 0,
}) => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState(() => 
    sessionCache.lastUserId === user?.id ? sessionCache.sessions : []
  );
  const [isInitialLoading, setIsInitialLoading] = useState(() => 
    !(sessionCache.lastUserId === user?.id && sessionCache.hasFetched)
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const [renameSessionId, setRenameSessionId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const renameInputRef = useRef(null);
  const pendingRefreshRef = useRef(false);

  const fetchSessions = useCallback(async (showLoading = false) => {
    if (!user) return;
    
    if (sessionCache.isFetching) {
      pendingRefreshRef.current = true;
      console.log('📋 Queuing refresh - fetch already in progress');
      return;
    }
    sessionCache.isFetching = true;
    
    if (showLoading && sessionCache.sessions.length === 0) {
      setIsInitialLoading(true);
    }
    
    try {
      const response = await getWithAuth('/api/chat/sessions?limit=50');
      const data = await response.json();
      
      if (data.success && data.sessions) {
        sessionCache.sessions = data.sessions;
        sessionCache.hasFetched = true;
        sessionCache.lastUserId = user?.id;
        setSessions(data.sessions);
        if (onSessionsLoaded) {
          onSessionsLoaded(data.sessions);
        }
      }
    } catch (error) {
      if (error.message !== 'Unauthorized') {
        console.error('Error fetching sessions:', error);
      }
    } finally {
      setIsInitialLoading(false);
      sessionCache.isFetching = false;
      
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        console.log('📋 Processing queued refresh');
        setTimeout(() => fetchSessions(false), 100);
      }
    }
  }, [user, onSessionsLoaded]);

  useEffect(() => {
    if (user && !sessionCache.hasFetched) {
      fetchSessions(true);
    } else if (user && sessionCache.lastUserId !== user?.id) {
      sessionCache.hasFetched = false;
      sessionCache.sessions = [];
      sessionCache.lastUserId = null;
      fetchSessions(true);
    }
  }, [user, fetchSessions]);

  useEffect(() => {
    if (refreshTrigger > 0 && user) {
      fetchSessions(false);
    }
  }, [refreshTrigger, user, fetchSessions]);

  useEffect(() => {
    if (!user) {
      sessionCache.hasFetched = false;
      sessionCache.sessions = [];
      sessionCache.lastUserId = null;
      setSessions([]);
    }
  }, [user]);

  useEffect(() => {
    if (updatedSessionInfo && forceUpdateKey > 0) {
      const existingIndex = sessionCache.sessions.findIndex(
        s => s.session_id === updatedSessionInfo.sessionId
      );
      
      if (existingIndex >= 0) {
        const updatedSessions = [...sessionCache.sessions];
        updatedSessions[existingIndex] = {
          ...updatedSessions[existingIndex],
          ...updatedSessionInfo.updates,
        };
        sessionCache.sessions = updatedSessions;
        setSessions(updatedSessions);
      } else {
        console.log('📋 Session not found in cache, triggering fetch');
        fetchSessions(false);
      }
    }
  }, [updatedSessionInfo, forceUpdateKey, fetchSessions]);

  const handleDeleteSession = async (sessionId) => {
    setIsDeleting(true);
    setDeletingSessionId(sessionId);
    
    const removeFromLocalState = () => {
      localStorage.removeItem(`chatMessages_${sessionId}`);
      localStorage.removeItem(`filesUploaded_${sessionId}`);
      localStorage.removeItem(`uploadedFileNames_${sessionId}`);
      localStorage.removeItem(`tableSessionIds_${sessionId}`);
      console.log('🗑️ Cleared localStorage for deleted session:', sessionId);
      
      const updatedSessions = sessions.filter(s => s.session_id !== sessionId);
      sessionCache.sessions = updatedSessions;
      setSessions(updatedSessions);
      setDeleteConfirmId(null);
      
      if (activeSessionId === sessionId) {
        if (updatedSessions.length > 0) {
          onSelectSession(updatedSessions[0]);
        }
      }
    };
    
    try {
      const response = await deleteWithAuth(`/api/chat/sessions/${sessionId}`);
      const data = await response.json();
      
      if (data.success || data.error === 'Session not found') {
        removeFromLocalState();
      }
    } catch (error) {
      if (error.message !== 'Unauthorized') {
        removeFromLocalState();
      }
    } finally {
      setIsDeleting(false);
      setDeletingSessionId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const now = new Date();
    
    const dateYear = date.getFullYear();
    const dateMonth = date.getMonth();
    const dateDay = date.getDate();
    
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDay = now.getDate();
    
    if (dateYear === nowYear && dateMonth === nowMonth && dateDay === nowDay) {
      return t('chatHistory.today');
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateYear === yesterday.getFullYear() && dateMonth === yesterday.getMonth() && dateDay === yesterday.getDate()) {
      return t('chatHistory.yesterday');
    }
    
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (date > weekAgo) {
      return date.toLocaleDateString('da-DK', { weekday: 'short' });
    }
    
    return date.toLocaleDateString('da-DK', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const handleStartRename = (e, session) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
    setRenameSessionId(session.session_id);
    setRenameValue(getSessionTitle(session));
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const handleCancelRename = () => {
    setRenameSessionId(null);
    setRenameValue('');
  };

  const handleConfirmRename = async (sessionId) => {
    const newTitle = renameValue.trim().slice(0, 255);
    if (!newTitle) {
      handleCancelRename();
      return;
    }
    
    setIsRenaming(true);
    
    const updatedSessions = sessions.map(s => 
      s.session_id === sessionId ? { ...s, title: newTitle } : s
    );
    sessionCache.sessions = updatedSessions;
    setSessions(updatedSessions);
    
    try {
      await putWithAuth(`/api/chat/sessions/${sessionId}`, { title: newTitle });
      console.log('📝 Session renamed:', newTitle);
    } catch (error) {
      console.error('Error renaming session:', error);
      fetchSessions(false);
    } finally {
      setIsRenaming(false);
      setRenameSessionId(null);
      setRenameValue('');
    }
  };

  const handleRenameKeyDown = (e, sessionId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmRename(sessionId);
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  const handleNewChatClick = async () => {
    if (isCreatingChat || isReadOnly) return;
    setIsCreatingChat(true);
    try {
      await onNewChat();
    } finally {
      setIsCreatingChat(false);
    }
  };

  const getSessionTitle = (session) => {
    if (session.title) return session.title;
    
    if (session.old_file_name && session.new_file_name) {
      return `📄 ${session.old_file_name} ↔ ${session.new_file_name}`;
    }
    
    const files = session.files || [];
    if (files.length >= 2) {
      const oldFile = files.find(f => f.file_type === 'old_schedule');
      const newFile = files.find(f => f.file_type === 'new_schedule');
      if (oldFile && newFile) {
        return `📄 ${oldFile.original_filename} ↔ ${newFile.original_filename}`;
      }
    }
    
    return t('chatHistory.untitledChat');
  };

  return (
    <div 
      className="h-full flex flex-shrink-0 relative"
      style={{ width: isOpen ? sidebarWidth : 0 }}
    >
      {isOpen && (
        <div 
          className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          <div className="p-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #00D6D6 0%, #00B8B8 100%)' }}>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {t('chatHistory.title')}
            </h2>
          </div>
          
          <div className="p-3 border-b border-gray-100">
            <button
              onClick={handleNewChatClick}
              disabled={isReadOnly || isCreatingChat}
              className={`w-full py-2.5 px-3 rounded-xl text-sm font-medium flex items-center gap-3 transition-all duration-200 shadow-sm ${
                isReadOnly 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : isCreatingChat
                    ? 'bg-gray-50 text-gray-500 cursor-wait border border-gray-200'
                    : 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5 border border-gray-200'
              }`}
              title={isReadOnly ? t('readOnly.cannotPerformAction') : ''}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                isReadOnly ? 'bg-gray-300' : isCreatingChat ? 'bg-[#00D6D6]/60' : 'bg-[#00D6D6]'
              }`}>
                {isCreatingChat ? (
                  <MiniSpinner size={14} color="white" />
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </span>
              {isCreatingChat ? t('chatHistory.creating') || 'Creating...' : t('chatHistory.newChat')}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isInitialLoading && sessions.length === 0 ? (
              <SessionSkeleton />
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 px-3">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-xs">{t('chatHistory.noChats')}</p>
                <p className="text-gray-400 text-xs mt-1">{t('chatHistory.startNewChat')}</p>
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {sessions.map((session) => {
                  const isBeingDeleted = deletingSessionId === session.session_id;
                  
                  return (
                    <div
                      key={session.session_id}
                      className={`group relative rounded-lg transition-all duration-300 ${
                        isBeingDeleted
                          ? 'opacity-50 scale-[0.97] pointer-events-none'
                          : activeSessionId === session.session_id
                            ? 'bg-[#00D6D6]/10 border border-[#00D6D6]/30'
                            : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      {renameSessionId === session.session_id ? (
                        <div className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => handleRenameKeyDown(e, session.session_id)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 text-xs px-2 py-1.5 border border-[#00D6D6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D6D6]"
                              maxLength={255}
                              disabled={isRenaming}
                            />
                            <button
                              onClick={() => handleConfirmRename(session.session_id)}
                              disabled={isRenaming}
                              className="p-1 bg-[#00D6D6] text-white rounded hover:bg-[#00B8B8] transition-colors min-w-[24px] flex items-center justify-center"
                              title={t('common.save')}
                            >
                              {isRenaming ? (
                                <MiniSpinner size={12} color="white" />
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={handleCancelRename}
                              disabled={isRenaming}
                              className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                              title={t('common.cancel')}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => onSelectSession(session)}
                            className="w-full text-left p-2"
                          >
                            <div className="flex items-start gap-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isBeingDeleted
                                  ? 'bg-red-100 text-red-400'
                                  : activeSessionId === session.session_id
                                    ? 'bg-[#00D6D6] text-white'
                                    : 'bg-gray-100 text-gray-500'
                              }`}>
                                {isBeingDeleted ? (
                                  <MiniSpinner size={14} color="#ef4444" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 pr-10">
                                <p className={`text-xs font-medium truncate ${isBeingDeleted ? 'text-red-400 line-through' : 'text-gray-800'}`}>
                                  {getSessionTitle(session)}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {isBeingDeleted ? (t('chatHistory.deleting') || 'Deleting...') : formatDate(session.last_activity_at || session.created_at)}
                                </p>
                              </div>
                            </div>
                          </button>
                          
                          {!isBeingDeleted && deleteConfirmId === session.session_id ? (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                              <button
                                onClick={() => handleDeleteSession(session.session_id)}
                                className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                title={t('chatHistory.confirmDelete')}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                                title={t('common.cancel')}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : !isBeingDeleted ? (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={(e) => handleStartRename(e, session)}
                                className="p-1 text-gray-400 hover:text-[#00D6D6] hover:bg-[#00D6D6]/10 rounded transition-colors"
                                title={t('chatHistory.rename')}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(session.session_id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title={t('chatHistory.delete')}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400 text-center">
              {sessions.length} {t('chatHistory.totalChats')}
            </p>
          </div>
        </div>
      )}
      
      {isOpen && (
        <div
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize z-10 group ${isResizing ? 'bg-[#00D6D6]' : 'hover:bg-[#00D6D6]/50'}`}
          onMouseDown={onResizeStart}
          style={{ transform: 'translateX(50%)' }}
        >
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 rounded-full flex items-center justify-center transition-opacity ${isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            style={{ background: 'linear-gradient(135deg, #00D6D6 0%, #00B8B8 100%)' }}
          >
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5h2v14H8V5zm6 0h2v14h-2V5z" />
            </svg>
          </div>
        </div>
      )}
      
      <button
        onClick={onToggle}
        className={`absolute top-1/2 -translate-y-1/2 z-20 w-5 h-10 flex items-center justify-center rounded-r-lg shadow-md transition-all duration-200 hover:shadow-lg ${
          isOpen ? 'right-0 translate-x-full' : 'left-0'
        }`}
        style={{ background: 'linear-gradient(135deg, #00D6D6 0%, #00B8B8 100%)' }}
        title={isOpen ? t('chatHistory.hide') : t('chatHistory.show')}
      >
        <svg 
          className={`w-3 h-3 text-white transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

export default React.memo(ChatHistorySidebar);
