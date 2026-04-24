import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getWithAuth, postWithAuth, putWithAuth, deleteWithAuth } from '../utils/authApi';

function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const CompanyPortal = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [company, setCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: 'standard_user',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [auditEventFilter, setAuditEventFilter] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditUserSearch, setAuditUserSearch] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  const debouncedSearchQuery = useDebounce(searchQuery);
  const debouncedAuditUserSearch = useDebounce(auditUserSearch);
  const debouncedChatSearchQuery = useDebounce(chatSearchQuery);
  
  const [chatHistories, setChatHistories] = useState([]);
  const [chatHistoriesLoading, setChatHistoriesLoading] = useState(false);
  const [chatHistoriesPagination, setChatHistoriesPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [chatUserFilter, setChatUserFilter] = useState('');
  const [chatUsers, setChatUsers] = useState([]);
  const [selectedChatSession, setSelectedChatSession] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessagesLoading, setChatMessagesLoading] = useState(false);

  const fetchCompanyInfo = async () => {
    try {
      const response = await getWithAuth('/api/company/info');
      const data = await response.json();
      if (data.success) {
        setCompany(data.company);
      }
    } catch (error) {
      if (error.message === 'Unauthorized') return;
      console.error('Error fetching company info:', error);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
      
      const response = await getWithAuth(`/api/company/users?${params}`);
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      } else {
        setError(data.error || t('companyPortal.couldNotFetch'));
      }
    } catch (error) {
      if (error.message === 'Unauthorized') return;
      console.error('Error fetching users:', error);
      setError(t('companyPortal.couldNotFetch'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({
        page: auditPagination.page.toString(),
        limit: auditPagination.limit.toString(),
      });
      if (auditEventFilter) params.append('eventType', auditEventFilter);
      if (auditDateFrom) params.append('startDate', auditDateFrom);
      if (auditDateTo) params.append('endDate', auditDateTo);
      if (debouncedAuditUserSearch) params.append('actorEmail', debouncedAuditUserSearch);
      
      const response = await getWithAuth(`/api/company/audit-logs?${params}`);
      const data = await response.json();
      if (data.success) {
        setAuditLogs(data.logs);
        setAuditPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      if (error.message === 'Unauthorized') return;
      console.error('Error fetching audit logs:', error);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (auditEventFilter) params.append('eventType', auditEventFilter);
      if (auditDateFrom) params.append('startDate', auditDateFrom);
      if (auditDateTo) params.append('endDate', auditDateTo);
      if (debouncedAuditUserSearch) params.append('actorEmail', debouncedAuditUserSearch);
      
      const response = await getWithAuth(`/api/company/audit-logs/export?${params}`);
      const data = await response.json();
      if (data.success || data.logs) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting audit logs:', error);
    }
  };

  const handleExportChatHistories = async () => {
    try {
      const params = new URLSearchParams();
      if (chatUserFilter) params.append('userId', chatUserFilter);
      if (debouncedChatSearchQuery) params.append('search', debouncedChatSearchQuery);
      
      const response = await getWithAuth(`/api/company/chat-histories/export?${params}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-histories-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting chat histories:', error);
    }
  };

  const handleExportSingleChat = async (sessionId) => {
    try {
      const response = await getWithAuth(`/api/company/chat-histories/${sessionId}/export`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-session-${sessionId}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting chat session:', error);
    }
  };

  const fetchChatHistories = async () => {
    setChatHistoriesLoading(true);
    try {
      const params = new URLSearchParams({
        page: chatHistoriesPagination.page.toString(),
        limit: chatHistoriesPagination.limit.toString(),
      });
      if (chatUserFilter) params.append('userId', chatUserFilter);
      if (debouncedChatSearchQuery) params.append('search', debouncedChatSearchQuery);
      
      const response = await getWithAuth(`/api/company/chat-histories?${params}`);
      const data = await response.json();
      if (data.success) {
        setChatHistories(data.sessions);
        setChatUsers(data.users || []);
        setChatHistoriesPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      if (error.message === 'Unauthorized') return;
      console.error('Error fetching chat histories:', error);
    } finally {
      setChatHistoriesLoading(false);
    }
  };

  const fetchChatMessages = async (sessionId, sessionPreview = null) => {
    // Open modal immediately with preview data if available
    if (sessionPreview) {
      setSelectedChatSession({
        id: sessionPreview.id,
        title: sessionPreview.title,
        user: { name: sessionPreview.userEmail },
        createdAt: sessionPreview.lastActivity || sessionPreview.createdAt
      });
    }
    setChatMessagesLoading(true);
    setChatMessages([]);
    try {
      const response = await getWithAuth(`/api/company/chat-histories/${sessionId}/messages`);
      const data = await response.json();
      if (data.success) {
        setSelectedChatSession(data.session);
        setChatMessages(data.messages);
      }
    } catch (error) {
      if (error.message === 'Unauthorized') return;
      console.error('Error fetching chat messages:', error);
    } finally {
      setChatMessagesLoading(false);
    }
  };

  const closeChatModal = () => {
    setSelectedChatSession(null);
    setChatMessages([]);
  };

  useEffect(() => {
    fetchCompanyInfo();
    fetchUsers();
  }, [pagination.page, debouncedSearchQuery]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'company') {
      fetchCompanyInfo();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, auditPagination.page, auditEventFilter, auditDateFrom, auditDateTo, debouncedAuditUserSearch]);

  useEffect(() => {
    if (activeTab === 'chats') {
      fetchChatHistories();
    }
  }, [activeTab, chatHistoriesPagination.page, chatUserFilter, debouncedChatSearchQuery]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (isEdit = false) => {
    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = t('admin.validation.firstNameRequired');
    if (!formData.lastName.trim()) errors.lastName = t('admin.validation.lastNameRequired');
    if (!formData.email.trim()) errors.email = t('admin.validation.emailRequired');
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = t('admin.validation.emailInvalid');
    if (!isEdit && !formData.password) errors.password = t('admin.validation.passwordRequired');
    else if (formData.password && formData.password.length < 8) errors.password = t('admin.validation.passwordMinLength');
    
    if (formData.phoneNumber && formData.phoneNumber.trim()) {
      const cleaned = formData.phoneNumber.replace(/[\s\-\(\)\+]/g, '');
      if (!/^\d+$/.test(cleaned) || cleaned.length < 6 || cleaned.length > 15) {
        errors.phoneNumber = t('admin.phoneError');
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const response = await postWithAuth('/api/company/users', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber || null,
        role: formData.role,
      });
      
      const data = await response.json();
      if (data.success) {
        setShowAddModal(false);
        resetForm();
        fetchUsers();
      } else {
        setFormErrors({ general: data.error || t('companyPortal.couldNotCreate') });
      }
    } catch (error) {
      if (error.message === 'Unauthorized') return;
      console.error('Error creating user:', error);
      setFormErrors({ general: t('companyPortal.couldNotCreate') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber || null,
        role: formData.role,
      };
      if (formData.password) payload.password = formData.password;
      
      const response = await putWithAuth(`/api/company/users/${selectedUser.id}`, payload);
      
      const data = await response.json();
      if (data.success) {
        setShowEditModal(false);
        resetForm();
        fetchUsers();
      } else {
        setFormErrors({ general: data.error || t('companyPortal.couldNotUpdate') });
      }
    } catch (error) {
      if (error.message === 'Unauthorized') return;
      console.error('Error updating user:', error);
      setFormErrors({ general: t('companyPortal.couldNotUpdate') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    setIsSubmitting(true);
    try {
      const response = await deleteWithAuth(`/api/company/users/${selectedUser.id}`);
      
      const data = await response.json();
      if (data.success) {
        setShowDeleteModal(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        setError(data.error || t('companyPortal.couldNotDelete'));
      }
    } catch (error) {
      if (error.message === 'Unauthorized') return;
      console.error('Error deleting user:', error);
      setError(t('companyPortal.couldNotDelete'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', email: '', password: '', phoneNumber: '', role: 'standard_user' });
    setFormErrors({});
    setSelectedUser(null);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      phoneNumber: user.phoneNumber || '',
      role: user.role || 'standard_user',
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-28 pb-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#00D6D6' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{t('companyPortal.title')}</h1>
            <p className="text-gray-600">{company?.name || t('companyPortal.subtitle')}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'users' ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            style={activeTab === 'users' ? { background: '#00D6D6' } : {}}
          >
            {t('companyPortal.manageUsers')}
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'company' ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            style={activeTab === 'company' ? { background: '#00D6D6' } : {}}
          >
            {t('companyPortal.companyInfo')}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'audit' ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            style={activeTab === 'audit' ? { background: '#00D6D6' } : {}}
          >
            {t('companyPortal.auditLogs')}
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'chats' ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            style={activeTab === 'chats' ? { background: '#00D6D6' } : {}}
          >
            {t('companyPortal.chatHistories')}
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800">{t('admin.users')} ({pagination.total})</h2>
                <input
                  type="text"
                  placeholder={t('admin.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50"
                />
              </div>
              <button
                onClick={() => { resetForm(); setShowAddModal(true); }}
                className="px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 hover:scale-105 transition-all"
                style={{ background: '#00D6D6' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t('companyPortal.addUser')}
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-[#00D6D6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">{t('admin.loading')}</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">{t('companyPortal.noUsers')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left" style={{ background: '#00D6D6' }}>
                      <th className="px-4 py-3 text-white font-semibold rounded-tl-xl">{t('admin.firstName')} / {t('admin.lastName')}</th>
                      <th className="px-4 py-3 text-white font-semibold">{t('admin.email')}</th>
                      <th className="px-4 py-3 text-white font-semibold">{t('admin.role')}</th>
                      <th className="px-4 py-3 text-white font-semibold">{t('companyPortal.status')}</th>
                      <th className="px-4 py-3 text-white font-semibold">{t('admin.createdAt')}</th>
                      <th className="px-4 py-3 text-white font-semibold rounded-tr-xl">{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {user.role === 'super_admin' ? (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: '#dc2626' }}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                              </div>
                            ) : user.role === 'company_owner' ? (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: '#7c3aed' }}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: '#00D6D6' }}>
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </div>
                            )}
                            <span className="font-medium text-gray-800">
                              {user.role === 'company_owner' ? (user.companyName || company?.name || user.email) : `${user.firstName || ''} ${user.lastName || ''}`.trim()}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-600">{user.email}</td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            user.role === 'super_admin'
                              ? 'bg-red-100 text-red-700'
                              : user.role === 'company_owner' 
                                ? 'bg-purple-100 text-purple-700' 
                                : user.role === 'read_only_user' 
                                  ? 'bg-orange-100 text-orange-700' 
                                  : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.role === 'super_admin'
                              ? t('companyPortal.superAdmin')
                              : user.role === 'company_owner' 
                                ? t('companyPortal.owner') 
                                : user.role === 'read_only_user' 
                                  ? t('companyPortal.readOnlyUser') 
                                  : t('companyPortal.standardUser')}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {user.isActive !== false ? t('companyPortal.active') : t('companyPortal.inactive')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString('da-DK') : '-'}
                        </td>
                        <td className="px-4 py-4">
                          {user.role !== 'company_owner' && user.role !== 'super_admin' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => openEditModal(user)}
                                className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openDeleteModal(user)}
                                className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-50"
                >
                  {t('admin.pagination.previous')}
                </button>
                <span className="px-4 py-2 text-gray-600">
                  {t('admin.pagination.page')} {pagination.page} {t('admin.pagination.of')} {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-50"
                >
                  {t('admin.pagination.next')}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'company' && company && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">{t('companyPortal.companyDetails')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('companySignup.companyName')}</label>
                <p className="text-lg text-gray-800">{company.name}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('companySignup.cvrNumber')}</label>
                <p className="text-lg text-gray-800">{company.cvrNumber || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('admin.companyIndustry')}</label>
                <p className="text-lg text-gray-800">{company.industry || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('companySignup.companySize')}</label>
                <p className="text-lg text-gray-800">{company.size || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('admin.companyAddress')}</label>
                <p className="text-lg text-gray-800">{company.address || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('companySignup.companyPhone')}</label>
                <p className="text-lg text-gray-800">{company.phoneNumber || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('admin.email')}</label>
                <p className="text-lg text-gray-800">{company.email || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('companySignup.companyWebsite')}</label>
                <p className="text-lg text-gray-800">{company.website || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('companyPortal.totalUsers')}</label>
                <p className="text-lg text-gray-800">{company.userCount || 0}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">{t('companyPortal.auditLogs')}</h2>
              <button
                onClick={handleExportAuditLogs}
                className="px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 hover:scale-105 transition-all"
                style={{ background: '#00D6D6' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('companyPortal.exportLogs')}
              </button>
            </div>
            
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={auditUserSearch}
                  onChange={(e) => { setAuditUserSearch(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                  placeholder={t('companyPortal.searchByUserEmail')}
                  className="px-4 py-2 pl-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50 w-64"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={auditEventFilter}
                onChange={(e) => { setAuditEventFilter(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50"
              >
                <option value="">{t('companyPortal.allEvents')}</option>
                <option value="login">{t('companyPortal.eventLogin')}</option>
                <option value="chat_created">{t('companyPortal.eventChatCreated')}</option>
                <option value="chat_renamed">{t('companyPortal.eventChatRenamed')}</option>
                <option value="chat_deleted">{t('companyPortal.eventChatDeleted')}</option>
                <option value="message_sent">{t('companyPortal.eventMessageSent')}</option>
                <option value="file_uploaded">{t('companyPortal.eventFileUploaded')}</option>
                <option value="file_downloaded">{t('companyPortal.eventFileDownloaded')}</option>
                <option value="pdf_downloaded">{t('companyPortal.eventPdfDownloaded')}</option>
                <option value="pdf_session_downloaded">{t('companyPortal.eventPdfSessionDownloaded')}</option>
                <option value="annotation_created">{t('companyPortal.eventAnnotationCreated')}</option>
                <option value="annotation_deleted">{t('companyPortal.eventAnnotationDeleted')}</option>
                <option value="user_created">{t('companyPortal.eventUserCreated')}</option>
                <option value="user_updated">{t('companyPortal.eventUserUpdated')}</option>
                <option value="user_deleted">{t('companyPortal.eventUserDeleted')}</option>
              </select>
              <input
                type="date"
                value={auditDateFrom}
                onChange={(e) => { setAuditDateFrom(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50"
                placeholder={t('companyPortal.dateFrom')}
              />
              <input
                type="date"
                value={auditDateTo}
                onChange={(e) => { setAuditDateTo(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50"
                placeholder={t('companyPortal.dateTo')}
              />
              {(auditEventFilter || auditDateFrom || auditDateTo || auditUserSearch) && (
                <button
                  onClick={() => { setAuditEventFilter(''); setAuditDateFrom(''); setAuditDateTo(''); setAuditUserSearch(''); setAuditPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  {t('companyPortal.clearFilters')}
                </button>
              )}
            </div>

            {auditLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-[#00D6D6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">{t('admin.loading')}</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">{t('companyPortal.noAuditLogs')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left" style={{ background: '#00D6D6' }}>
                      <th className="px-4 py-3 text-white font-semibold rounded-tl-xl">{t('companyPortal.dateTime')}</th>
                      <th className="px-4 py-3 text-white font-semibold">{t('companyPortal.eventType')}</th>
                      <th className="px-4 py-3 text-white font-semibold">{t('companyPortal.user')}</th>
                      <th className="px-4 py-3 text-white font-semibold rounded-tr-xl">{t('companyPortal.description')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4 text-gray-600">
                          {new Date(log.createdAt).toLocaleString('da-DK')}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            log.eventType === 'login' ? 'bg-green-100 text-green-700' :
                            log.eventType === 'chat_created' ? 'bg-cyan-100 text-cyan-700' :
                            log.eventType === 'chat_renamed' ? 'bg-sky-100 text-sky-700' :
                            log.eventType === 'chat_deleted' ? 'bg-red-100 text-red-700' :
                            log.eventType === 'message_sent' ? 'bg-indigo-100 text-indigo-700' :
                            log.eventType === 'file_uploaded' ? 'bg-purple-100 text-purple-700' :
                            log.eventType === 'file_downloaded' ? 'bg-violet-100 text-violet-700' :
                            log.eventType === 'pdf_downloaded' || log.eventType === 'pdf_session_downloaded' ? 'bg-amber-100 text-amber-700' :
                            log.eventType === 'annotation_created' ? 'bg-teal-100 text-teal-700' :
                            log.eventType === 'annotation_deleted' ? 'bg-orange-100 text-orange-700' :
                            log.eventType === 'user_created' ? 'bg-blue-100 text-blue-700' :
                            log.eventType === 'user_updated' ? 'bg-blue-100 text-blue-700' :
                            log.eventType === 'user_deleted' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {t(`companyPortal.event${log.eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`) || log.eventType}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-600">{log.actor?.name || log.actor?.email || '-'}</td>
                        <td className="px-4 py-4 text-gray-600">{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {auditPagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setAuditPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                  disabled={auditPagination.page === 1}
                  className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-50"
                >
                  {t('admin.pagination.prev')}
                </button>
                <span className="px-4 py-2 text-gray-600">
                  {t('admin.pagination.page')} {auditPagination.page} {t('admin.pagination.of')} {auditPagination.totalPages}
                </span>
                <button
                  onClick={() => setAuditPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                  disabled={auditPagination.page === auditPagination.totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-50"
                >
                  {t('admin.pagination.next')}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chats' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">{t('companyPortal.chatHistories')}</h2>
              <button
                onClick={handleExportChatHistories}
                className="px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 hover:scale-105 transition-all"
                style={{ background: '#00D6D6' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('companyPortal.exportChats')}
              </button>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  value={chatSearchQuery}
                  onChange={(e) => { setChatSearchQuery(e.target.value); setChatHistoriesPagination(p => ({ ...p, page: 1 })); }}
                  placeholder={t('companyPortal.searchByUserNameEmail')}
                  className="w-full px-4 py-2 pl-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={chatUserFilter}
                onChange={(e) => { setChatUserFilter(e.target.value); setChatHistoriesPagination(p => ({ ...p, page: 1 })); }}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50"
              >
                <option value="">{t('companyPortal.allUsers')}</option>
                {chatUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              {(chatSearchQuery || chatUserFilter) && (
                <button
                  onClick={() => { setChatSearchQuery(''); setChatUserFilter(''); setChatHistoriesPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  {t('companyPortal.clearFilters')}
                </button>
              )}
            </div>

            {chatHistoriesLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-[#00D6D6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">{t('admin.loading')}</p>
              </div>
            ) : chatHistories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">{t('companyPortal.noChatHistories')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left" style={{ background: '#00D6D6' }}>
                      <th className="px-4 py-3 text-white font-semibold rounded-tl-xl">{t('companyPortal.chatTitle')}</th>
                      <th className="px-4 py-3 text-white font-semibold">{t('companyPortal.user')}</th>
                      <th className="px-4 py-3 text-white font-semibold">{t('companyPortal.messages')}</th>
                      <th className="px-4 py-3 text-white font-semibold">{t('companyPortal.lastActivity')}</th>
                      <th className="px-4 py-3 text-white font-semibold rounded-tr-xl">{t('companyPortal.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chatHistories.map((session) => (
                      <tr key={session.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-800">{session.title || t('companyPortal.untitledChat')}</p>
                            {(session.oldFileName || session.newFileName) && (
                              <p className="text-xs text-gray-500 mt-1">
                                {session.oldFileName && <span>📄 {session.oldFileName}</span>}
                                {session.oldFileName && session.newFileName && <span> ↔ </span>}
                                {session.newFileName && <span>{session.newFileName}</span>}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-600">{session.user?.name || session.user?.email}</td>
                        <td className="px-4 py-4 text-gray-600">{session.messageCount}</td>
                        <td className="px-4 py-4 text-gray-600">
                          {session.lastActivityAt ? new Date(session.lastActivityAt).toLocaleString('da-DK') : '-'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => fetchChatMessages(session.id, session)}
                              className="px-4 py-2 rounded-lg text-white text-sm hover:opacity-90"
                              style={{ background: '#00D6D6' }}
                            >
                              {t('companyPortal.viewChat')}
                            </button>
                            <button
                              onClick={() => handleExportSingleChat(session.id)}
                              className="px-3 py-2 rounded-lg border border-[#00D6D6] text-[#00D6D6] text-sm hover:bg-[#00D6D6]/10"
                              title={t('companyPortal.exportChat')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {chatHistoriesPagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setChatHistoriesPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                  disabled={chatHistoriesPagination.page === 1}
                  className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-50"
                >
                  {t('admin.pagination.prev')}
                </button>
                <span className="px-4 py-2 text-gray-600">
                  {t('admin.pagination.page')} {chatHistoriesPagination.page} {t('admin.pagination.of')} {chatHistoriesPagination.totalPages}
                </span>
                <button
                  onClick={() => setChatHistoriesPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                  disabled={chatHistoriesPagination.page === chatHistoriesPagination.totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-50"
                >
                  {t('admin.pagination.next')}
                </button>
              </div>
            )}
          </div>
        )}

        {selectedChatSession && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeChatModal}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-100 flex justify-between items-center" style={{ background: '#00D6D6' }}>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedChatSession.title || t('companyPortal.untitledChat')}</h3>
                  <p className="text-white/80 text-sm">{selectedChatSession.user?.name} • {new Date(selectedChatSession.createdAt).toLocaleDateString('da-DK')}</p>
                </div>
                <button onClick={closeChatModal} className="text-white hover:text-white/80 text-3xl font-light w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">&times;</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[400px]">
                {chatMessagesLoading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="flex justify-start">
                      <div className="max-w-[70%] bg-gray-200 rounded-2xl rounded-bl-md h-20 w-96"></div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[70%] bg-[#00D6D6]/30 rounded-2xl rounded-br-md h-12 w-48"></div>
                    </div>
                    <div className="flex justify-start">
                      <div className="max-w-[70%] bg-gray-200 rounded-2xl rounded-bl-md h-32 w-[500px]"></div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[70%] bg-[#00D6D6]/30 rounded-2xl rounded-br-md h-12 w-36"></div>
                    </div>
                    <div className="flex justify-start">
                      <div className="max-w-[70%] bg-gray-200 rounded-2xl rounded-bl-md h-24 w-80"></div>
                    </div>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <p className="text-center text-gray-500">{t('companyPortal.noMessages')}</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.senderType === 'user' 
                          ? 'bg-[#00D6D6] text-white rounded-br-md' 
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}>
                        {msg.contentType === 'file-info' ? (
                          <div className="flex items-center gap-2">
                            <span>📄</span>
                            <span className="text-sm">{msg.content}</span>
                          </div>
                        ) : msg.isHtml ? (
                          <div dangerouslySetInnerHTML={{ __html: msg.content }} className="prose prose-sm max-w-none" />
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <p className={`text-xs mt-1 ${msg.senderType === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-800 mb-6">
                {showAddModal ? t('companyPortal.addUserTitle') : t('companyPortal.editUser')}
              </h3>
              
              {formErrors.general && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                  {formErrors.general}
                </div>
              )}
              
              <form onSubmit={showAddModal ? handleAddUser : handleEditUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.firstName')} *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-xl border ${formErrors.firstName ? 'border-red-500' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50`}
                    />
                    {formErrors.firstName && <p className="text-red-500 text-xs mt-1">{formErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.lastName')} *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-xl border ${formErrors.lastName ? 'border-red-500' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50`}
                    />
                    {formErrors.lastName && <p className="text-red-500 text-xs mt-1">{formErrors.lastName}</p>}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.email')} *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-xl border ${formErrors.email ? 'border-red-500' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50`}
                  />
                  {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {t('admin.password')} {showAddModal ? '*' : t('admin.newPasswordHint')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder={showEditModal ? t('admin.newPasswordPlaceholder') : ''}
                      className={`w-full px-4 py-3 rounded-xl border ${formErrors.password ? 'border-red-500' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
                  {formData.password && (
                    <div className="mt-2 space-y-1">
                      {[
                        { key: 'passwordTipMin', check: formData.password.length >= 8 },
                        { key: 'passwordTipUpper', check: /[A-Z]/.test(formData.password) },
                        { key: 'passwordTipLower', check: /[a-z]/.test(formData.password) },
                        { key: 'passwordTipNumber', check: /\d/.test(formData.password) },
                        { key: 'passwordTipSpecial', check: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) },
                      ].map(({ key, check }) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${check ? 'text-green-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                            {check ? (
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            ) : (
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            )}
                          </svg>
                          <span className={`text-xs transition-colors ${check ? 'text-green-600' : 'text-gray-400'}`}>{t(`admin.${key}`)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.phoneNumber')}</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50"
                    placeholder={t('admin.phonePlaceholder')}
                  />
                  {formErrors.phoneNumber && <p className="text-red-500 text-xs mt-1">{formErrors.phoneNumber}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('companyPortal.userRole')} *</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D6D6]/50 bg-white"
                  >
                    <option value="standard_user">{t('companyPortal.standardUser')}</option>
                    <option value="read_only_user">{t('companyPortal.readOnlyUser')}</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.role === 'standard_user' ? t('companyPortal.standardUserDesc') : t('companyPortal.readOnlyUserDesc')}
                  </p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                    className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
                  >
                    {t('admin.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 rounded-xl text-white font-semibold disabled:opacity-50"
                    style={{ background: '#00D6D6' }}
                  >
                    {isSubmitting ? (showAddModal ? t('admin.creating') : t('admin.updating')) : (showAddModal ? t('admin.createUser') : t('admin.updateUser'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{t('companyPortal.deleteUser')}</h3>
                <p className="text-gray-600 mb-6">{t('companyPortal.deleteConfirm')}</p>
                <p className="text-sm text-gray-500 mb-6">{selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
                  >
                    {t('admin.cancel')}
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 rounded-xl text-white font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50"
                  >
                    {isSubmitting ? t('admin.deleting') : t('admin.delete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyPortal;
