import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getWithAuth, deleteWithAuth, putWithAuth, postWithAuth } from '../utils/authApi';

function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function SuperAdminPortal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [recentCompaniesLimit, setRecentCompaniesLimit] = useState(5);
  const [recentUsersLimit, setRecentUsersLimit] = useState(5);
  const [recentUsersPage, setRecentUsersPage] = useState(1);
  const [recentCompaniesPage, setRecentCompaniesPage] = useState(1);
  
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesPagination, setCompaniesPagination] = useState(null);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  
  const [deleteUserModal, setDeleteUserModal] = useState({ isOpen: false, user: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [toggleUserStatusModal, setToggleUserStatusModal] = useState({ isOpen: false, user: null });
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [auditEventFilter, setAuditEventFilter] = useState('');
  const [auditCompanyFilter, setAuditCompanyFilter] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditUserSearch, setAuditUserSearch] = useState('');
  const [auditCompanies, setAuditCompanies] = useState([]);
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [auditCompanyUsers, setAuditCompanyUsers] = useState([]);
  
  const [chatHistories, setChatHistories] = useState([]);
  const [chatHistoriesLoading, setChatHistoriesLoading] = useState(false);
  const [chatHistoriesPagination, setChatHistoriesPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [chatCompanyFilter, setChatCompanyFilter] = useState('');
  const [chatUserFilter, setChatUserFilter] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatCompanies, setChatCompanies] = useState([]);

  const debouncedSearchQuery = useDebounce(searchQuery);
  const debouncedCompanySearchQuery = useDebounce(companySearchQuery);
  const debouncedAuditUserSearch = useDebounce(auditUserSearch);
  const debouncedChatSearchQuery = useDebounce(chatSearchQuery);
  const [chatUsers, setChatUsers] = useState([]);
  const [selectedChatSession, setSelectedChatSession] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessagesLoading, setChatMessagesLoading] = useState(false);
  
  const [addCompanyModal, setAddCompanyModal] = useState({ isOpen: false });
  const [addCompanyForm, setAddCompanyForm] = useState({
    name: '',
    email: '',
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    ownerPassword: ''
  });
  const [addCompanyLoading, setAddCompanyLoading] = useState(false);
  const [addCompanyError, setAddCompanyError] = useState('');

  const fetchDashboard = useCallback(async (companiesLimit = 5, usersLimit = 5, usersPage = 1, companiesPage = 1) => {
    try {
      const params = new URLSearchParams({
        companiesLimit: companiesLimit.toString(),
        usersLimit: usersLimit.toString(),
        usersPage: usersPage.toString(),
        companiesPage: companiesPage.toString()
      });
      const response = await getWithAuth(`/api/super-admin/dashboard?${params}`);
      const data = await response.json();
      if (data.success) {
        setDashboard(data.dashboard);
      }
    } catch (err) {
      if (err.message === 'Unauthorized') return;
      console.error('Failed to fetch dashboard:', err);
    }
  }, []);

  const fetchCompanies = useCallback(async (page = 1, search = '') => {
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.append('search', search);
      
      const response = await getWithAuth(`/api/super-admin/companies?${params}`);
      const data = await response.json();
      if (data.success) {
        setCompanies(data.companies);
        setCompaniesPagination(data.pagination);
      }
    } catch (err) {
      if (err.message === 'Unauthorized') return;
      console.error('Failed to fetch companies:', err);
    }
  }, []);

  const fetchUsers = useCallback(async (page = 1, search = '', role = '', companyId = null) => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (search) params.append('search', search);
      if (role) params.append('role', role);
      if (companyId) params.append('company_id', companyId);
      
      const response = await getWithAuth(`/api/super-admin/users?${params}`);
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
        setUsersPagination(data.pagination);
      }
    } catch (err) {
      if (err.message === 'Unauthorized') return;
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(recentCompaniesLimit, recentUsersLimit, recentUsersPage, recentCompaniesPage), fetchCompanies()]);
      await fetchUsers(1, '', '', null);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchCompanies, fetchUsers]);

  useEffect(() => {
    if (!loading && activeTab === 'dashboard') {
      fetchDashboard(recentCompaniesLimit, recentUsersLimit, recentUsersPage, recentCompaniesPage);
    }
  }, [activeTab, recentCompaniesLimit, recentUsersLimit, recentUsersPage, recentCompaniesPage]);

  useEffect(() => {
    if (activeTab === 'management') {
      fetchCompanies(companiesPage, debouncedCompanySearchQuery);
    }
  }, [activeTab, companiesPage, debouncedCompanySearchQuery, fetchCompanies]);

  useEffect(() => {
    if (activeTab === 'management') {
      fetchUsers(usersPage, debouncedSearchQuery, roleFilter, selectedCompanyId);
    }
  }, [activeTab, usersPage, debouncedSearchQuery, roleFilter, selectedCompanyId, fetchUsers]);

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({
        page: auditPagination.page.toString(),
        limit: auditPagination.limit.toString(),
      });
      if (auditEventFilter) params.append('eventType', auditEventFilter);
      if (auditCompanyFilter) params.append('companyId', auditCompanyFilter);
      if (auditUserFilter) params.append('userId', auditUserFilter);
      if (auditDateFrom) params.append('startDate', auditDateFrom);
      if (auditDateTo) params.append('endDate', auditDateTo);
      if (debouncedAuditUserSearch) params.append('actorEmail', debouncedAuditUserSearch);
      
      const response = await getWithAuth(`/api/super-admin/audit-logs?${params}`);
      const data = await response.json();
      if (data.success) {
        setAuditLogs(data.logs);
        setAuditCompanies(data.companies || []);
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
      if (auditCompanyFilter) params.append('companyId', auditCompanyFilter);
      if (auditUserFilter) params.append('userId', auditUserFilter);
      if (auditDateFrom) params.append('startDate', auditDateFrom);
      if (auditDateTo) params.append('endDate', auditDateTo);
      if (debouncedAuditUserSearch) params.append('actorEmail', debouncedAuditUserSearch);
      
      const response = await getWithAuth(`/api/super-admin/audit-logs/export?${params}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `platform-audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
    }
  };

  const handleExportChatHistories = async () => {
    try {
      const params = new URLSearchParams();
      if (chatCompanyFilter) params.append('companyId', chatCompanyFilter);
      if (chatUserFilter) params.append('userId', chatUserFilter);
      if (debouncedChatSearchQuery) params.append('search', debouncedChatSearchQuery);
      
      const response = await getWithAuth(`/api/super-admin/chat-histories/export?${params}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-chat-histories-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting chat histories:', error);
    }
  };

  const handleExportSingleChat = async (sessionId) => {
    try {
      const response = await getWithAuth(`/api/super-admin/chat-histories/${sessionId}/export`);
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
      if (chatCompanyFilter) params.append('companyId', chatCompanyFilter);
      if (chatUserFilter) params.append('userId', chatUserFilter);
      if (debouncedChatSearchQuery) params.append('search', debouncedChatSearchQuery);
      
      const response = await getWithAuth(`/api/super-admin/chat-histories?${params}`);
      const data = await response.json();
      if (data.success) {
        setChatHistories(data.sessions);
        setChatCompanies(data.companies || []);
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
        company: { name: sessionPreview.companyName },
        createdAt: sessionPreview.lastActivity || sessionPreview.createdAt
      });
    }
    setChatMessagesLoading(true);
    setChatMessages([]);
    try {
      const response = await getWithAuth(`/api/super-admin/chat-histories/${sessionId}/messages`);
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
    if (activeTab === 'chats') {
      fetchChatHistories();
    }
  }, [activeTab, chatHistoriesPagination.page, chatCompanyFilter, chatUserFilter, debouncedChatSearchQuery]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, auditPagination.page, auditEventFilter, auditCompanyFilter, auditUserFilter, auditDateFrom, auditDateTo, debouncedAuditUserSearch]);

  const fetchCompanyUsers = async (companyId) => {
    if (!companyId) return [];
    try {
      const response = await getWithAuth(`/api/super-admin/companies/${companyId}/users?limit=100`);
      const data = await response.json();
      if (data.success) {
        return data.users.map(u => ({
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email: u.email
        }));
      }
    } catch (e) {
      console.error('Error fetching company users:', e);
    }
    return [];
  };

  useEffect(() => {
    if (auditCompanyFilter) {
      fetchCompanyUsers(auditCompanyFilter).then(users => setAuditCompanyUsers(users));
    } else {
      setAuditCompanyUsers([]);
    }
    setAuditUserFilter('');
  }, [auditCompanyFilter]);

  useEffect(() => {
    if (chatCompanyFilter) {
      fetchCompanyUsers(chatCompanyFilter).then(users => setChatUsers(users));
    } else {
      setChatUsers([]);
    }
    setChatUserFilter('');
  }, [chatCompanyFilter]);

  const handleSelectCompany = (company) => {
    if (selectedCompanyId === company.id) {
      setSelectedCompanyId(null);
      setSelectedCompany(null);
    } else {
      setSelectedCompanyId(company.id);
      setSelectedCompany(company);
    }
    setUsersPage(1);
  };

  const handleShowAllUsers = () => {
    setSelectedCompanyId(null);
    setSelectedCompany(null);
    setUsersPage(1);
  };

  const handleDeleteCompany = async (companyId, companyName) => {
    if (!window.confirm(t('superAdmin.confirmDeleteCompany', { name: companyName }))) return;
    
    try {
      const response = await deleteWithAuth(`/api/super-admin/companies/${companyId}`);
      const data = await response.json();
      if (data.success) {
        setCompaniesPage(1);
        fetchCompanies(1, companySearchQuery);
        fetchDashboard();
        if (selectedCompanyId === companyId) {
          setSelectedCompanyId(null);
          setSelectedCompany(null);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      if (err.message === 'Unauthorized') return;
      setError('Failed to delete company');
    }
  };

  const openAddCompanyModal = () => {
    setAddCompanyForm({
      name: '',
      email: '',
      ownerFirstName: '',
      ownerLastName: '',
      ownerEmail: '',
      ownerPassword: ''
    });
    setAddCompanyError('');
    setAddCompanyModal({ isOpen: true });
  };

  const closeAddCompanyModal = () => {
    setAddCompanyModal({ isOpen: false });
    setAddCompanyError('');
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setAddCompanyLoading(true);
    setAddCompanyError('');
    
    try {
      const response = await postWithAuth('/api/super-admin/companies', {
        name: addCompanyForm.name,
        email: addCompanyForm.email,
        ownerFirstName: addCompanyForm.ownerFirstName,
        ownerLastName: addCompanyForm.ownerLastName,
        ownerEmail: addCompanyForm.ownerEmail,
        ownerPassword: addCompanyForm.ownerPassword
      });
      const data = await response.json();
      
      if (data.success) {
        closeAddCompanyModal();
        fetchCompanies(1, '');
        fetchDashboard();
        setCompaniesPage(1);
        setCompanySearchQuery('');
      } else {
        setAddCompanyError(data.error || 'Failed to create company');
      }
    } catch (err) {
      if (err.message === 'Unauthorized') return;
      setAddCompanyError('Failed to create company. Please try again.');
    } finally {
      setAddCompanyLoading(false);
    }
  };

  const openDeleteUserModal = (user) => {
    setDeleteUserModal({ isOpen: true, user });
  };

  const closeDeleteUserModal = () => {
    setDeleteUserModal({ isOpen: false, user: null });
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserModal.user) return;
    
    setIsDeleting(true);
    try {
      const response = await deleteWithAuth(`/api/super-admin/users/${deleteUserModal.user.id}`);
      const data = await response.json();
      if (data.success) {
        fetchUsers(usersPage, searchQuery, roleFilter, selectedCompanyId);
        fetchDashboard();
        fetchCompanies(companiesPage, companySearchQuery);
        closeDeleteUserModal();
      } else {
        setError(data.error);
      }
    } catch (err) {
      if (err.message === 'Unauthorized') return;
      setError('Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const openToggleUserStatusModal = (user) => {
    setToggleUserStatusModal({ isOpen: true, user });
  };

  const closeToggleUserStatusModal = () => {
    setToggleUserStatusModal({ isOpen: false, user: null });
  };

  const handleConfirmToggleUserStatus = async () => {
    const user = toggleUserStatusModal.user;
    if (!user) return;
    
    setIsTogglingStatus(true);
    try {
      const response = await putWithAuth(`/api/super-admin/users/${user.id}`, { isActive: !user.isActive });
      const data = await response.json();
      if (data.success) {
        fetchUsers(usersPage, searchQuery, roleFilter, selectedCompanyId);
        closeToggleUserStatusModal();
      }
    } catch (err) {
      if (err.message === 'Unauthorized') return;
      setError('Failed to update user');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleToggleCompanyStatus = async (company) => {
    try {
      const response = await putWithAuth(`/api/super-admin/companies/${company.id}`, { isActive: !company.isActive });
      const data = await response.json();
      if (data.success) {
        fetchCompanies(companiesPage, companySearchQuery);
      }
    } catch (err) {
      if (err.message === 'Unauthorized') return;
      setError('Failed to update company');
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color = 'cyan' }) => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color === 'cyan' ? 'text-cyan-600' : `text-${color}-600`}`}>{value}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${color === 'cyan' ? 'bg-cyan-100' : `bg-${color}-100`}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );

  const RoleBadge = ({ role }) => {
    const colors = {
      super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
      admin: 'bg-red-100 text-red-800 border-red-200',
      company_owner: 'bg-blue-100 text-blue-800 border-blue-200',
      standard_user: 'bg-green-100 text-green-800 border-green-200',
      read_only_user: 'bg-gray-100 text-gray-800 border-gray-200',
      user: 'bg-gray-100 text-gray-600 border-gray-200'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[role] || colors.user}`}>
        {t(`admin.roles.${role}`, role)}
      </span>
    );
  };

  const StatusBadge = ({ isActive }) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
      isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      {isActive ? t('superAdmin.active') : t('superAdmin.inactive')}
    </span>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-cyan-50/30 to-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-cyan-50/30 to-gray-100 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('superAdmin.title')}</h1>
              <p className="text-gray-500 text-sm">{t('superAdmin.subtitle')}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-4 text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        <div className="flex gap-2 mb-6 bg-white/60 backdrop-blur-sm p-1 rounded-xl shadow-sm w-fit">
          {['dashboard', 'management', 'audit', 'chats'].map((tab) => (
            <button
              key={tab}
              onClick={() => { 
                setActiveTab(tab); 
                setSearchQuery(''); 
                setCompanySearchQuery('');
                setRoleFilter(''); 
                if (tab === 'management') {
                  setSelectedCompanyId(null);
                  setSelectedCompany(null);
                }
              }}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'audit' ? t('companyPortal.auditLogs') : tab === 'chats' ? t('companyPortal.chatHistories') : tab === 'management' ? t('superAdmin.tabs.management') : t(`superAdmin.tabs.${tab}`)}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title={t('superAdmin.totalCompanies')} value={dashboard.totalCompanies} icon="🏢" />
              <StatCard title={t('superAdmin.totalUsers')} value={dashboard.totalUsers} icon="👥" />
              <StatCard title={t('superAdmin.activeUsers')} value={dashboard.activeUsers} icon="✅" />
              <StatCard 
                title={t('superAdmin.inactiveUsers')} 
                value={dashboard.totalUsers - dashboard.activeUsers} 
                icon="⏸️" 
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('superAdmin.usersByRole')}</h3>
                <div className="space-y-3">
                  {dashboard.usersByRole.map((item) => (
                    <div key={item.role} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <RoleBadge role={item.role} />
                      <span className="font-semibold text-gray-700">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{t('superAdmin.recentCompanies')}</h3>
                  <select
                    value={recentCompaniesLimit}
                    onChange={(e) => setRecentCompaniesLimit(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400 bg-white cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {dashboard.recentCompanies.map((company) => (
                    <div key={company.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900">{company.name}</p>
                        <p className="text-xs text-gray-500">{company.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-cyan-600">{company.userCount} {t('superAdmin.users')}</p>
                        <StatusBadge isActive={company.isActive} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('superAdmin.recentUsers')}</h3>
                <select
                  value={recentUsersLimit}
                  onChange={(e) => { setRecentUsersLimit(Number(e.target.value)); setRecentUsersPage(1); }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400 bg-white cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.name')}</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.email')}</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.company')}</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.role')}</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">{user.firstName} {user.lastName}</td>
                        <td className="py-3 px-4 text-gray-600">{user.email}</td>
                        <td className="py-3 px-4 text-gray-600">{user.companyName || '-'}</td>
                        <td className="py-3 px-4"><RoleBadge role={user.role} /></td>
                        <td className="py-3 px-4"><StatusBadge isActive={user.isActive} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dashboard.recentUsersPagination && dashboard.recentUsersPagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
                  <span className="text-sm text-gray-500">
                    {t('superAdmin.page')} {dashboard.recentUsersPagination.page} {t('superAdmin.of')} {dashboard.recentUsersPagination.totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRecentUsersPage(prev => Math.max(1, prev - 1))}
                      disabled={recentUsersPage <= 1}
                      className={`p-2 rounded-lg border transition-all ${recentUsersPage <= 1 ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-600 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-600'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button
                      onClick={() => setRecentUsersPage(prev => Math.min(dashboard.recentUsersPagination.totalPages, prev + 1))}
                      disabled={recentUsersPage >= dashboard.recentUsersPagination.totalPages}
                      className={`p-2 rounded-lg border transition-all ${recentUsersPage >= dashboard.recentUsersPagination.totalPages ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-600 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-600'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'management' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden sticky top-4">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span>🏢</span> {t('superAdmin.tabs.companies')}
                    </h3>
                    <button
                      onClick={openAddCompanyModal}
                      className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('superAdmin.addCompany')}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('superAdmin.searchCompanies')}
                      value={companySearchQuery}
                      onChange={(e) => { setCompanySearchQuery(e.target.value); setCompaniesPage(1); }}
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all text-sm"
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                
                <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                  <button
                    onClick={handleShowAllUsers}
                    className={`w-full p-4 text-left border-b border-gray-100 transition-all ${
                      selectedCompanyId === null 
                        ? 'bg-cyan-50 border-l-4 border-l-cyan-500' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white text-lg">
                          👥
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{t('superAdmin.allUsers')}</p>
                          <p className="text-xs text-gray-500">{t('superAdmin.viewAllPlatformUsers')}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-semibold">
                        {dashboard?.totalUsers || 0}
                      </span>
                    </div>
                  </button>

                  {companies.map((company) => (
                    <div
                      key={company.id}
                      className={`border-b border-gray-100 transition-all ${
                        selectedCompanyId === company.id 
                          ? 'bg-cyan-50 border-l-4 border-l-cyan-500' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <button
                        onClick={() => handleSelectCompany(company)}
                        className="w-full p-4 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold ${
                              company.isSuperAdmin 
                                ? 'bg-gradient-to-br from-purple-500 to-purple-600' 
                                : 'bg-gradient-to-br from-gray-400 to-gray-500'
                            }`}>
                              {company.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{company.name}</p>
                              <p className="text-xs text-gray-500 truncate">{company.email}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                              {company.userCount} {t('superAdmin.users')}
                            </span>
                            <StatusBadge isActive={company.isActive} />
                          </div>
                        </div>
                      </button>
                      
                      {selectedCompanyId === company.id && (
                        <div className="px-4 pb-4 flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleCompanyStatus(company); }}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                              company.isActive 
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {company.isActive ? t('superAdmin.deactivate') : t('superAdmin.activate')}
                          </button>
                          {!company.isSuperAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteCompany(company.id, company.name); }}
                              className="py-2 px-3 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-medium transition-colors"
                            >
                              {t('superAdmin.delete')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {companiesPagination && companiesPagination.totalPages > 1 && (
                  <div className="p-3 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => setCompaniesPage(p => Math.max(1, p - 1))}
                      disabled={!companiesPagination.hasPrev}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    >
                      ←
                    </button>
                    <span className="text-xs text-gray-500">
                      {companiesPage} / {companiesPagination.totalPages}
                    </span>
                    <button
                      onClick={() => setCompaniesPage(p => p + 1)}
                      disabled={!companiesPagination.hasNext}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <span>👥</span> 
                        {selectedCompany ? selectedCompany.name : t('superAdmin.allUsers')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedCompany 
                          ? t('superAdmin.usersInCompany', { company: selectedCompany.name })
                          : t('superAdmin.allPlatformUsers')
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder={t('superAdmin.searchUsers')}
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setUsersPage(1); }}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all text-sm"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <select
                      value={roleFilter}
                      onChange={(e) => { setRoleFilter(e.target.value); setUsersPage(1); }}
                      className="px-3 py-2 rounded-lg border border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all bg-white text-sm"
                    >
                      <option value="">{t('superAdmin.allRoles')}</option>
                      <option value="super_admin">{t('roles.super_admin')}</option>
                      <option value="admin">{t('roles.admin')}</option>
                      <option value="company_owner">{t('roles.company_owner')}</option>
                      <option value="standard_user">{t('roles.standard_user')}</option>
                      <option value="read_only_user">{t('roles.read_only_user')}</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.name')}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.email')}</th>
                        {!selectedCompanyId && (
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.company')}</th>
                        )}
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.role')}</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.status')}</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">{t('superAdmin.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersLoading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={`skeleton-${i}`} className="border-b border-gray-100">
                            <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded-md animate-pulse w-28" /></td>
                            <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded-md animate-pulse w-40" /></td>
                            {!selectedCompanyId && <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded-md animate-pulse w-24" /></td>}
                            <td className="py-3 px-4 text-center"><div className="h-5 bg-gray-200 rounded-full animate-pulse w-20 mx-auto" /></td>
                            <td className="py-3 px-4 text-center"><div className="h-5 bg-gray-200 rounded-full animate-pulse w-16 mx-auto" /></td>
                            <td className="py-3 px-4"><div className="flex gap-1 justify-center"><div className="h-7 w-7 bg-gray-200 rounded-lg animate-pulse" /><div className="h-7 w-7 bg-gray-200 rounded-lg animate-pulse" /></div></td>
                          </tr>
                        ))
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={selectedCompanyId ? 5 : 6} className="py-12 text-center text-gray-500">
                            {t('superAdmin.noUsers')}
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id} className="border-b border-gray-100 hover:bg-cyan-50/30 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                            </td>
                            <td className="py-3 px-4 text-gray-600 text-sm">{user.email}</td>
                            {!selectedCompanyId && (
                              <td className="py-3 px-4 text-gray-600 text-sm">{user.companyName || '-'}</td>
                            )}
                            <td className="py-3 px-4 text-center"><RoleBadge role={user.role} /></td>
                            <td className="py-3 px-4 text-center"><StatusBadge isActive={user.isActive} /></td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openToggleUserStatusModal(user)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    user.isActive 
                                      ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' 
                                      : 'bg-green-100 text-green-600 hover:bg-green-200'
                                  }`}
                                  title={user.isActive ? t('superAdmin.deactivate') : t('superAdmin.activate')}
                                >
                                  {user.isActive ? '⏸️' : '▶️'}
                                </button>
                                {user.role !== 'super_admin' && (
                                  <button
                                    onClick={() => openDeleteUserModal(user)}
                                    className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                    title={t('superAdmin.delete')}
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {usersPagination && usersPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      {t('superAdmin.showing')} {((usersPage - 1) * 10) + 1} - {Math.min(usersPage * 10, usersPagination.totalItems)} {t('superAdmin.of')} {usersPagination.totalItems}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                        disabled={!usersPagination.hasPrev}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {t('common.previous')}
                      </button>
                      <button
                        onClick={() => setUsersPage(p => p + 1)}
                        disabled={!usersPagination.hasNext}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {t('common.next')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">{t('companyPortal.auditLogs')}</h2>
                <button
                  onClick={handleExportAuditLogs}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium flex items-center gap-2 hover:shadow-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('companyPortal.exportLogs')}
                </button>
              </div>
              
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="relative">
                  <input
                    type="text"
                    value={auditUserSearch}
                    onChange={(e) => { setAuditUserSearch(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                    placeholder={t('companyPortal.searchByUserEmail')}
                    className="px-4 py-2 pl-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 w-64"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <select
                  value={auditEventFilter}
                  onChange={(e) => { setAuditEventFilter(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
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
                <select
                  value={auditCompanyFilter}
                  onChange={(e) => { setAuditCompanyFilter(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="">{t('superAdmin.allCompanies')}</option>
                  {(auditCompanies.length > 0 ? auditCompanies : companies).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={auditUserFilter}
                  onChange={(e) => { setAuditUserFilter(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  disabled={!auditCompanyFilter}
                >
                  <option value="">{t('companyPortal.allUsers')}</option>
                  {auditCompanyUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={auditDateFrom}
                  onChange={(e) => { setAuditDateFrom(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <input
                  type="date"
                  value={auditDateTo}
                  onChange={(e) => { setAuditDateTo(e.target.value); setAuditPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                {(auditEventFilter || auditCompanyFilter || auditUserFilter || auditDateFrom || auditDateTo || auditUserSearch) && (
                  <button
                    onClick={() => { setAuditEventFilter(''); setAuditCompanyFilter(''); setAuditUserFilter(''); setAuditDateFrom(''); setAuditDateTo(''); setAuditUserSearch(''); setAuditPagination(p => ({ ...p, page: 1 })); }}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    {t('companyPortal.clearFilters')}
                  </button>
                )}
              </div>
            </div>

            {auditLoading ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">{t('common.loading')}</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">{t('companyPortal.noAuditLogs')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('companyPortal.dateTime')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('companyPortal.eventType')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('companyPortal.user')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('superAdmin.company')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('companyPortal.description')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('da-DK')}
                        </td>
                        <td className="px-6 py-4">
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
                        <td className="px-6 py-4 text-sm text-gray-600">{log.actor?.name || log.actor?.email || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{log.companyName || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {auditPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  {t('superAdmin.showing')} {((auditPagination.page - 1) * auditPagination.limit) + 1} - {Math.min(auditPagination.page * auditPagination.limit, auditPagination.total)} {t('superAdmin.of')} {auditPagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuditPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    disabled={auditPagination.page === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {t('common.previous')}
                  </button>
                  <button
                    onClick={() => setAuditPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                    disabled={auditPagination.page === auditPagination.totalPages}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {t('common.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chats' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-semibold text-gray-900">{t('companyPortal.chatHistories')}</h2>
                <button
                  onClick={handleExportChatHistories}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium flex items-center gap-2 hover:shadow-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('companyPortal.exportChats')}
                </button>
              </div>
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="relative flex-1 max-w-sm">
                  <input
                    type="text"
                    value={chatSearchQuery}
                    onChange={(e) => { setChatSearchQuery(e.target.value); setChatHistoriesPagination(p => ({ ...p, page: 1 })); }}
                    placeholder={t('companyPortal.searchByUserNameEmail')}
                    className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <select
                  value={chatCompanyFilter}
                  onChange={(e) => { setChatCompanyFilter(e.target.value); setChatUserFilter(''); setChatHistoriesPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="">{t('companyPortal.allCompanies')}</option>
                  {chatCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={chatUserFilter}
                  onChange={(e) => { setChatUserFilter(e.target.value); setChatHistoriesPagination(p => ({ ...p, page: 1 })); }}
                  className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="">{t('companyPortal.allUsers')}</option>
                  {chatUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                {(chatCompanyFilter || chatUserFilter || chatSearchQuery) && (
                  <button
                    onClick={() => { setChatCompanyFilter(''); setChatUserFilter(''); setChatSearchQuery(''); setChatHistoriesPagination(p => ({ ...p, page: 1 })); }}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                  >
                    {t('companyPortal.clearFilters')}
                  </button>
                )}
              </div>
            </div>

            {chatHistoriesLoading ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">{t('common.loading')}</p>
              </div>
            ) : chatHistories.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">{t('companyPortal.noChatHistories')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('companyPortal.chatTitle')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('companyPortal.user')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('superAdmin.company')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('companyPortal.messages')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('companyPortal.lastActivity')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('companyPortal.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {chatHistories.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
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
                        <td className="px-6 py-4 text-sm text-gray-600">{session.user?.name || session.user?.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{session.company?.name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{session.messageCount}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {session.lastActivityAt ? new Date(session.lastActivityAt).toLocaleString('da-DK') : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => fetchChatMessages(session.id, session)}
                              className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm hover:bg-cyan-600"
                            >
                              {t('companyPortal.viewChat')}
                            </button>
                            <button
                              onClick={() => handleExportSingleChat(session.id)}
                              className="px-3 py-2 rounded-lg border border-cyan-500 text-cyan-500 text-sm hover:bg-cyan-50"
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
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  {t('superAdmin.showing')} {((chatHistoriesPagination.page - 1) * chatHistoriesPagination.limit) + 1} - {Math.min(chatHistoriesPagination.page * chatHistoriesPagination.limit, chatHistoriesPagination.total)} {t('superAdmin.of')} {chatHistoriesPagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChatHistoriesPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    disabled={chatHistoriesPagination.page === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {t('common.previous')}
                  </button>
                  <button
                    onClick={() => setChatHistoriesPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                    disabled={chatHistoriesPagination.page === chatHistoriesPagination.totalPages}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {t('common.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedChatSession && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeChatModal}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-cyan-500 to-cyan-600">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedChatSession.title || t('companyPortal.untitledChat')}</h3>
                  <p className="text-white/80 text-sm">{selectedChatSession.user?.name} • {selectedChatSession.company?.name} • {new Date(selectedChatSession.createdAt).toLocaleDateString('da-DK')}</p>
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
                      <div className="max-w-[70%] bg-cyan-200 rounded-2xl rounded-br-md h-12 w-48"></div>
                    </div>
                    <div className="flex justify-start">
                      <div className="max-w-[70%] bg-gray-200 rounded-2xl rounded-bl-md h-32 w-[500px]"></div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[70%] bg-cyan-200 rounded-2xl rounded-br-md h-12 w-36"></div>
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
                          ? 'bg-cyan-500 text-white rounded-br-md' 
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
      </div>

      {deleteUserModal.isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={closeDeleteUserModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 bg-red-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{t('superAdmin.deleteUserTitle')}</h3>
                  <p className="text-sm text-gray-600">{t('superAdmin.deleteUserWarning')}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-2">{t('superAdmin.userToDelete')}:</p>
                <p className="font-semibold text-gray-800">
                  {deleteUserModal.user?.firstName} {deleteUserModal.user?.lastName}
                </p>
                <p className="text-sm text-gray-600">{deleteUserModal.user?.email}</p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">🗑️</span>
                  <div>
                    <p className="text-sm font-medium text-amber-800">{t('superAdmin.deleteDataWarning')}</p>
                    <ul className="text-sm text-amber-700 mt-2 space-y-1">
                      <li>• {t('superAdmin.deleteUserAccount')}</li>
                      <li>• {t('superAdmin.deleteChatHistory')}</li>
                      <li>• {t('superAdmin.deleteChatMessages')}</li>
                      <li>• {t('superAdmin.deleteUploadedFiles')}</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 text-center mb-4">
                {t('superAdmin.deleteIrreversible')}
              </p>
            </div>
            
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={closeDeleteUserModal}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('common.deleting')}
                  </>
                ) : (
                  <>🗑️ {t('superAdmin.confirmDelete')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toggleUserStatusModal.isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={closeToggleUserStatusModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-6 border-b border-gray-100 ${toggleUserStatusModal.user?.isActive ? 'bg-orange-50' : 'bg-green-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${toggleUserStatusModal.user?.isActive ? 'bg-orange-100' : 'bg-green-100'}`}>
                  <span className="text-2xl">{toggleUserStatusModal.user?.isActive ? '⏸️' : '▶️'}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {toggleUserStatusModal.user?.isActive ? t('superAdmin.deactivateUserTitle') : t('superAdmin.activateUserTitle')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {toggleUserStatusModal.user?.isActive ? t('superAdmin.deactivateUserDesc') : t('superAdmin.activateUserDesc')}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-2">{t('superAdmin.userToUpdate')}:</p>
                <p className="font-semibold text-gray-800">
                  {toggleUserStatusModal.user?.firstName} {toggleUserStatusModal.user?.lastName}
                </p>
                <p className="text-sm text-gray-600">{toggleUserStatusModal.user?.email}</p>
              </div>
              
              <div className={`rounded-xl p-4 mb-4 ${toggleUserStatusModal.user?.isActive ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xl">{toggleUserStatusModal.user?.isActive ? '⚠️' : '✅'}</span>
                  <div>
                    <p className={`text-sm font-medium ${toggleUserStatusModal.user?.isActive ? 'text-orange-800' : 'text-green-800'}`}>
                      {toggleUserStatusModal.user?.isActive ? t('superAdmin.deactivateWarning') : t('superAdmin.activateInfo')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={closeToggleUserStatusModal}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmToggleUserStatus}
                disabled={isTogglingStatus}
                className={`flex-1 py-3 px-4 rounded-xl text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  toggleUserStatusModal.user?.isActive 
                    ? 'bg-orange-500 hover:bg-orange-600' 
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isTogglingStatus ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('common.updating')}
                  </>
                ) : (
                  <>
                    {toggleUserStatusModal.user?.isActive ? '⏸️' : '▶️'} 
                    {toggleUserStatusModal.user?.isActive ? t('superAdmin.confirmDeactivate') : t('superAdmin.confirmActivate')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {addCompanyModal.isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={closeAddCompanyModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-cyan-50 to-cyan-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{t('superAdmin.addCompanyTitle')}</h3>
                  <p className="text-sm text-gray-600">{t('superAdmin.addCompanySubtitle')}</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              {addCompanyError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {addCompanyError}
                </div>
              )}
              
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span>🏢</span> {t('superAdmin.companyInfo')}
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('superAdmin.companyName')} *</label>
                  <input
                    type="text"
                    required
                    value={addCompanyForm.name}
                    onChange={(e) => setAddCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    placeholder={t('superAdmin.enterCompanyName')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('superAdmin.companyEmail')}</label>
                  <input
                    type="email"
                    value={addCompanyForm.email}
                    onChange={(e) => setAddCompanyForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    placeholder={t('superAdmin.enterCompanyEmail')}
                  />
                </div>
              </div>
              
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span>👤</span> {t('superAdmin.ownerInfo')}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.firstName')} *</label>
                    <input
                      type="text"
                      required
                      value={addCompanyForm.ownerFirstName}
                      onChange={(e) => setAddCompanyForm(prev => ({ ...prev, ownerFirstName: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.lastName')} *</label>
                    <input
                      type="text"
                      required
                      value={addCompanyForm.ownerLastName}
                      onChange={(e) => setAddCompanyForm(prev => ({ ...prev, ownerLastName: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('superAdmin.ownerEmail')} *</label>
                  <input
                    type="email"
                    required
                    value={addCompanyForm.ownerEmail}
                    onChange={(e) => setAddCompanyForm(prev => ({ ...prev, ownerEmail: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    placeholder={t('superAdmin.enterOwnerEmail')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('superAdmin.ownerPassword')} *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={addCompanyForm.ownerPassword}
                      onChange={(e) => setAddCompanyForm(prev => ({ ...prev, ownerPassword: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 pr-10"
                      placeholder={t('superAdmin.minCharacters')}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeAddCompanyModal}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={addCompanyLoading}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addCompanyLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('common.creating')}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('superAdmin.createCompany')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
