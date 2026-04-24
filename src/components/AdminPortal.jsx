import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { getApiBaseUrl } from "../utils/apiConfig";
import CustomSelect from "./CustomSelect";

const AdminPortal = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "user",
    phoneNumber: "",
    companyName: "",
    companyAddress: "",
    companyIndustry: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [showPassword, setShowPassword] = useState(false);
  
  const addModalRef = useRef(null);
  const editModalRef = useRef(null);
  const deleteModalRef = useRef(null);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Filter state
  const [filters, setFilters] = useState({
    search: "",
    role: "",
  });
  const [searchInput, setSearchInput] = useState("");

  const API_BASE = getApiBaseUrl();

  const getAuthHeaders = () => {
    return {
      "Content-Type": "application/json",
    };
  };

  const fetchUsers = useCallback(async (page = 1, filtersToUse = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (filtersToUse.search) {
        params.append("search", filtersToUse.search);
      }
      if (filtersToUse.role) {
        params.append("role", filtersToUse.role);
      }

      const response = await axios.get(`${API_BASE}/api/admin/users?${params.toString()}`, {
        headers: getAuthHeaders(),
        withCredentials: true,
      });
      
      if (response.data.success) {
        setUsers(response.data.users);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        } else {
          // Fallback if no pagination in response
          setPagination(prev => ({
            ...prev,
            page: page,
            total: response.data.users.length,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          }));
        }
      }
    } catch (err) {
      console.error("Fetch users error:", err);
      if (err.response?.status === 403) {
        setError(t('admin.noAccess'));
        setTimeout(() => navigate("/"), 2000);
      } else if (err.response?.status === 401) {
        localStorage.removeItem("user");
        navigate("/login");
      } else {
        setError(t('admin.couldNotFetch'));
      }
    } finally {
      setLoading(false);
    }
  }, [API_BASE, navigate, pagination.limit, filters]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role !== "admin") {
      navigate("/");
      return;
    }
    fetchUsers(1, filters);
  }, [navigate]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters(prev => ({ ...prev, search: searchInput }));
        fetchUsers(1, { ...filters, search: searchInput });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleRoleFilterChange = (role) => {
    setFilters(prev => ({ ...prev, role }));
    fetchUsers(1, { ...filters, role });
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchUsers(newPage, filters);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "user",
      phoneNumber: "",
      companyName: "",
      companyAddress: "",
      companyIndustry: "",
    });
    setFormErrors({});
    setShowPassword(false);
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    const cleaned = value.replace(/[^0-9+\-\s()]/g, "");
    setFormData({ ...formData, phoneNumber: cleaned });
  };

  const handleModalBackdropClick = (e, closeModal) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const roleOptions = [
    { value: "user", label: t('admin.roles.user') },
    { value: "admin", label: t('admin.roles.admin') },
  ];

  const industryOptions = [
    { value: "", label: t('admin.industries.select') },
    { value: "Technology", label: t('admin.industries.technology') },
    { value: "Construction", label: t('admin.industries.construction') },
    { value: "Healthcare", label: t('admin.industries.healthcare') },
    { value: "Finance", label: t('admin.industries.finance') },
    { value: "Education", label: t('admin.industries.education') },
    { value: "Manufacturing", label: t('admin.industries.manufacturing') },
    { value: "Retail", label: t('admin.industries.retail') },
    { value: "Real Estate", label: t('admin.industries.realEstate') },
    { value: "Other", label: t('admin.industries.other') },
  ];

  const headerRoleOptions = [
    { value: "", label: t('admin.allRoles') },
    { value: "admin", label: t('admin.roles.admin') },
    { value: "user", label: t('admin.roles.user') },
  ];

  const validateForm = (isEdit = false) => {
    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = t('admin.validation.firstNameRequired');
    if (!formData.lastName.trim()) errors.lastName = t('admin.validation.lastNameRequired');
    if (!formData.email.trim()) errors.email = t('admin.validation.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('admin.validation.emailInvalid');
    }
    if (!isEdit && !formData.password) {
      errors.password = t('admin.validation.passwordRequired');
    } else if (formData.password && formData.password.length < 8) {
      errors.password = t('admin.validation.passwordMinLength');
    }
    if (!formData.companyName.trim()) {
      errors.companyName = t('admin.validation.companyNameRequired');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = () => {
    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      role: formData.role,
    };

    if (formData.password) {
      payload.password = formData.password;
    }

    if (formData.phoneNumber) {
      payload.phoneNumber = formData.phoneNumber;
    }

    // Always send company object to allow clearing optional fields
    payload.company = {
      name: formData.companyName || "",
      address: formData.companyAddress || "",
      industry: formData.companyIndustry || "",
    };

    return payload;
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const payload = buildPayload();
      
      const response = await axios.post(`${API_BASE}/api/admin/users`, payload, {
        headers: getAuthHeaders(),
        withCredentials: true,
      });
      if (response.data.success) {
        showToast(t('admin.userCreated'));
        setShowAddModal(false);
        resetForm();
        fetchUsers(pagination.page, filters);
      }
    } catch (err) {
      console.error("Add user error:", err);
      showToast(
        err.response?.data?.error || t('admin.couldNotCreate'),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    try {
      setSubmitting(true);
      const payload = buildPayload();

      const response = await axios.put(
        `${API_BASE}/api/admin/users/${selectedUser.id}`,
        payload,
        { headers: getAuthHeaders(), withCredentials: true },
      );
      if (response.data.success) {
        showToast(t('admin.userUpdated'));
        setShowEditModal(false);
        resetForm();
        setSelectedUser(null);
        fetchUsers(pagination.page, filters);
      }
    } catch (err) {
      console.error("Edit user error:", err);
      showToast(
        err.response?.data?.error || t('admin.couldNotUpdate'),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setSubmitting(true);
      const response = await axios.delete(
        `${API_BASE}/api/admin/users/${selectedUser.id}`,
        { headers: getAuthHeaders(), withCredentials: true },
      );
      if (response.data.success) {
        showToast(t('admin.userDeleted'));
        setShowDeleteModal(false);
        setSelectedUser(null);
        fetchUsers(pagination.page, filters);
      }
    } catch (err) {
      console.error("Delete user error:", err);
      showToast(
        err.response?.data?.error || t('admin.couldNotDelete'),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      password: "",
      role: user.role || "user",
      phoneNumber: user.phoneNumber || "",
      companyName: user.company?.name || "",
      companyAddress: user.company?.address || "",
      companyIndustry: user.company?.industry || "",
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("da-DK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00D6D6] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#1c2631] text-lg">{t('admin.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <p className="text-red-600 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {toast.show && (
        <div
          className={`fixed top-4 right-4 z-[9999] px-6 py-3 rounded-lg shadow-lg ${
            toast.type === "error" ? "bg-red-500" : "bg-[#00D6D6]"
          } text-white font-medium`}
        >
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center pt-28 gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00D6D6] flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1c2631]">
                {t('admin.title')}
              </h1>
              <p className="text-[#64748b]">
                {t('admin.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-[#00D6D6]/20 overflow-hidden">
          {/* Header with filters */}
          <div className="px-6 py-4 border-b border-[#00D6D6]/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#1c2631]">
                {t('admin.users')} ({pagination.total || users.length})
              </h2>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t('admin.searchPlaceholder')}
                    className="pl-10 pr-4 py-2 rounded-lg border border-[#00D6D6]/30 focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none w-full sm:w-64"
                  />
                  {searchInput && (
                    <button
                      onClick={() => {
                        setSearchInput("");
                        setFilters(prev => ({ ...prev, search: "" }));
                        fetchUsers(1, { ...filters, search: "" });
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#64748b] hover:text-[#1c2631]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Role Filter */}
                <CustomSelect
                  value={filters.role}
                  onChange={(value) => handleRoleFilterChange(value)}
                  options={headerRoleOptions}
                  placeholder={t('admin.allRoles')}
                  className="w-full sm:w-40"
                />

                {/* Add User Button */}
                <button
                  onClick={() => {
                    resetForm();
                    setShowAddModal(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-[#00D6D6] text-white rounded-lg hover:bg-[#00bfbf] transition-colors font-medium"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  {t('admin.addUser')}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#00D6D6] to-[#00bfbf]">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                    {t('admin.firstName')} / {t('admin.lastName')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                    {t('admin.email')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                    {t('admin.role')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                    {t('admin.createdAt')}
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-white">
                    {t('admin.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#00D6D6]/10">
                {users.map((user, index) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-[#00D6D6]/5 transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-[#e0f7f7]/30"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 max-w-[200px]">
                        <div className="w-10 h-10 min-w-[40px] rounded-full bg-[#00D6D6]/20 flex items-center justify-center">
                          <span className="text-[#00D6D6] font-semibold text-sm">
                            {user.firstName?.[0]?.toUpperCase()}
                            {user.lastName?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[#1c2631] font-medium truncate" title={`${user.firstName} ${user.lastName}`}>
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#64748b]">{user.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-[#00D6D6] text-white"
                            : "bg-[#e0f7f7] text-[#1c2631]"
                        }`}
                      >
                        {user.role === "admin" ? t('admin.roles.admin') : t('admin.roles.user')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#64748b]">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 rounded-lg bg-[#00D6D6]/10 text-[#00D6D6] hover:bg-[#00D6D6]/20 transition-colors"
                          title={t('admin.edit')}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => openDeleteModal(user)}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title={t('admin.delete')}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-[#64748b]"
                    >
                      {t('admin.noUsers')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Advanced Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#00D6D6]/20 bg-gradient-to-r from-[#e0f7f7]/30 to-white">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-[#64748b]">
                  {t('admin.pagination.showing')} {pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1} {t('admin.pagination.to')} {Math.min(pagination.page * pagination.limit, pagination.total)} {t('admin.pagination.of')} {pagination.total} {t('admin.usersCount')}
                </div>
                
                <div className="flex items-center gap-2">
                  {/* First Page */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={!pagination.hasPrevPage}
                    className={`p-2 rounded-lg transition-colors ${
                      pagination.hasPrevPage
                        ? "bg-[#00D6D6]/10 text-[#00D6D6] hover:bg-[#00D6D6]/20"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                    title={t('admin.pagination.first')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Previous Page */}
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage}
                    className={`p-2 rounded-lg transition-colors ${
                      pagination.hasPrevPage
                        ? "bg-[#00D6D6]/10 text-[#00D6D6] hover:bg-[#00D6D6]/20"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                    title={t('admin.pagination.previous')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {pagination.page > 3 && pagination.totalPages > 5 && (
                      <>
                        <button
                          onClick={() => handlePageChange(1)}
                          className="px-3 py-1 rounded-lg text-sm font-medium bg-[#00D6D6]/10 text-[#00D6D6] hover:bg-[#00D6D6]/20 transition-colors"
                        >
                          1
                        </button>
                        <span className="px-2 text-[#64748b]">...</span>
                      </>
                    )}
                    
                    {getPageNumbers().map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          pageNum === pagination.page
                            ? "bg-[#00D6D6] text-white shadow-md"
                            : "bg-[#00D6D6]/10 text-[#00D6D6] hover:bg-[#00D6D6]/20"
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}

                    {pagination.page < pagination.totalPages - 2 && pagination.totalPages > 5 && (
                      <>
                        <span className="px-2 text-[#64748b]">...</span>
                        <button
                          onClick={() => handlePageChange(pagination.totalPages)}
                          className="px-3 py-1 rounded-lg text-sm font-medium bg-[#00D6D6]/10 text-[#00D6D6] hover:bg-[#00D6D6]/20 transition-colors"
                        >
                          {pagination.totalPages}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Next Page */}
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                    className={`p-2 rounded-lg transition-colors ${
                      pagination.hasNextPage
                        ? "bg-[#00D6D6]/10 text-[#00D6D6] hover:bg-[#00D6D6]/20"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                    title={t('admin.pagination.next')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Last Page */}
                  <button
                    onClick={() => handlePageChange(pagination.totalPages)}
                    disabled={!pagination.hasNextPage}
                    className={`p-2 rounded-lg transition-colors ${
                      pagination.hasNextPage
                        ? "bg-[#00D6D6]/10 text-[#00D6D6] hover:bg-[#00D6D6]/20"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                    title={t('admin.pagination.last')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => handleModalBackdropClick(e, () => { setShowAddModal(false); resetForm(); })}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-[#00D6D6]">
              <h3 className="text-xl font-bold text-white">{t('admin.addUserTitle')}</h3>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1c2631] mb-1">
                    {t('admin.firstName')} <span className="text-red-500">{t('admin.required')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className={`w-full px-4 py-2 rounded-lg border ${
                      formErrors.firstName
                        ? "border-red-500"
                        : "border-[#00D6D6]/30"
                    } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                    placeholder="John"
                  />
                  {formErrors.firstName && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1c2631] mb-1">
                    {t('admin.lastName')} <span className="text-red-500">{t('admin.required')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className={`w-full px-4 py-2 rounded-lg border ${
                      formErrors.lastName
                        ? "border-red-500"
                        : "border-[#00D6D6]/30"
                    } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                    placeholder="Doe"
                  />
                  {formErrors.lastName && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.lastName}
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#1c2631] mb-1">
                  {t('admin.email')} <span className="text-red-500">{t('admin.required')}</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-lg border ${
                    formErrors.email ? "border-red-500" : "border-[#00D6D6]/30"
                  } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                  placeholder="john@example.com"
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-red-500">
                    {formErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1c2631] mb-1">
                  {t('admin.phoneNumber')} <span className="text-[#64748b] font-normal">{t('admin.optional')}</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                  className="w-full px-4 py-2 rounded-lg border border-[#00D6D6]/30 focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none"
                  placeholder={t('admin.phonePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1c2631] mb-1">
                  {t('admin.password')} <span className="text-red-500">{t('admin.required')}</span> <span className="text-[#64748b] font-normal">{t('admin.passwordHint')}</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={`w-full px-4 py-2 pr-12 rounded-lg border ${
                      formErrors.password
                        ? "border-red-500"
                        : "border-[#00D6D6]/30"
                    } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                    placeholder={t('admin.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#64748b] hover:text-[#00D6D6] transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="mt-1 text-xs text-red-500">
                    {formErrors.password}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1c2631] mb-1">
                  {t('admin.role')}
                </label>
                <CustomSelect
                  value={formData.role}
                  onChange={(value) => setFormData({ ...formData, role: value })}
                  options={roleOptions}
                  placeholder={t('admin.selectRole')}
                />
              </div>

              {/* Company Section */}
              <div className="pt-2 border-t border-[#00D6D6]/20">
                <h4 className="text-sm font-semibold text-[#1c2631] mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {t('admin.companyInfo')}
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1c2631] mb-1">
                      {t('admin.companyName')} <span className="text-red-500">{t('admin.required')}</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({ ...formData, companyName: e.target.value })
                      }
                      className={`w-full px-4 py-2 rounded-lg border ${
                        formErrors.companyName
                          ? "border-red-500"
                          : "border-[#00D6D6]/30"
                      } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                      placeholder="Acme Corp"
                    />
                    {formErrors.companyName && (
                      <p className="mt-1 text-xs text-red-500">
                        {formErrors.companyName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1c2631] mb-1">
                      {t('admin.companyAddress')} <span className="text-[#64748b] font-normal">{t('admin.optional')}</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, companyAddress: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-[#00D6D6]/30 focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none"
                      placeholder={t('admin.addressPlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1c2631] mb-1">
                      {t('admin.companyIndustry')} <span className="text-[#64748b] font-normal">{t('admin.optional')}</span>
                    </label>
                    <CustomSelect
                      value={formData.companyIndustry}
                      onChange={(value) => setFormData({ ...formData, companyIndustry: value })}
                      options={industryOptions}
                      placeholder={t('admin.selectIndustry')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-[#1c2631] rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-[#00D6D6] text-white rounded-lg hover:bg-[#00bfbf] transition-colors font-medium disabled:opacity-50"
                >
                  {submitting ? t('admin.creating') : t('admin.createUser')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => handleModalBackdropClick(e, () => { setShowEditModal(false); resetForm(); setSelectedUser(null); })}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-[#00D6D6]">
              <h3 className="text-xl font-bold text-white">{t('admin.editUser')}</h3>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1c2631] mb-1">
                    {t('admin.firstName')} <span className="text-red-500">{t('admin.required')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className={`w-full px-4 py-2 rounded-lg border ${
                      formErrors.firstName
                        ? "border-red-500"
                        : "border-[#00D6D6]/30"
                    } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                  />
                  {formErrors.firstName && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1c2631] mb-1">
                    {t('admin.lastName')} <span className="text-red-500">{t('admin.required')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className={`w-full px-4 py-2 rounded-lg border ${
                      formErrors.lastName
                        ? "border-red-500"
                        : "border-[#00D6D6]/30"
                    } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                  />
                  {formErrors.lastName && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.lastName}
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#1c2631] mb-1">
                  {t('admin.email')} <span className="text-red-500">{t('admin.required')}</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-lg border ${
                    formErrors.email ? "border-red-500" : "border-[#00D6D6]/30"
                  } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-red-500">
                    {formErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1c2631] mb-1">
                  {t('admin.phoneNumber')} <span className="text-[#64748b] font-normal">{t('admin.optional')}</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                  className="w-full px-4 py-2 rounded-lg border border-[#00D6D6]/30 focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none"
                  placeholder={t('admin.phonePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1c2631] mb-1">
                  {t('admin.newPassword')}{" "}
                  <span className="text-[#64748b] font-normal">{t('admin.newPasswordHint')}</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={`w-full px-4 py-2 pr-12 rounded-lg border ${
                      formErrors.password
                        ? "border-red-500"
                        : "border-[#00D6D6]/30"
                    } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                    placeholder={t('admin.newPasswordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#64748b] hover:text-[#00D6D6] transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="mt-1 text-xs text-red-500">
                    {formErrors.password}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1c2631] mb-1">
                  {t('admin.role')}
                </label>
                <CustomSelect
                  value={formData.role}
                  onChange={(value) => setFormData({ ...formData, role: value })}
                  options={roleOptions}
                  placeholder={t('admin.selectRole')}
                />
              </div>

              {/* Company Section */}
              <div className="pt-2 border-t border-[#00D6D6]/20">
                <h4 className="text-sm font-semibold text-[#1c2631] mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#00D6D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {t('admin.companyInfo')}
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1c2631] mb-1">
                      {t('admin.companyName')} <span className="text-red-500">{t('admin.required')}</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({ ...formData, companyName: e.target.value })
                      }
                      className={`w-full px-4 py-2 rounded-lg border ${
                        formErrors.companyName
                          ? "border-red-500"
                          : "border-[#00D6D6]/30"
                      } focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none`}
                      placeholder="Acme Corp"
                    />
                    {formErrors.companyName && (
                      <p className="mt-1 text-xs text-red-500">
                        {formErrors.companyName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1c2631] mb-1">
                      {t('admin.companyAddress')} <span className="text-[#64748b] font-normal">{t('admin.optional')}</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, companyAddress: e.target.value })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-[#00D6D6]/30 focus:ring-2 focus:ring-[#00D6D6] focus:border-transparent outline-none"
                      placeholder={t('admin.addressPlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1c2631] mb-1">
                      {t('admin.companyIndustry')} <span className="text-[#64748b] font-normal">{t('admin.optional')}</span>
                    </label>
                    <CustomSelect
                      value={formData.companyIndustry}
                      onChange={(value) => setFormData({ ...formData, companyIndustry: value })}
                      options={industryOptions}
                      placeholder={t('admin.selectIndustry')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                    setSelectedUser(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-[#1c2631] rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-[#00D6D6] text-white rounded-lg hover:bg-[#00bfbf] transition-colors font-medium disabled:opacity-50"
                >
                  {submitting ? t('admin.updating') : t('admin.updateUser')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => handleModalBackdropClick(e, () => { setShowDeleteModal(false); setSelectedUser(null); })}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-red-500">
              <h3 className="text-xl font-bold text-white">{t('admin.deleteUser')}</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-[#1c2631] font-medium">
                    {t('admin.deleteConfirm')}
                  </p>
                  <p className="text-[#64748b] text-sm mt-1">
                    {selectedUser.firstName} {selectedUser.lastName} (
                    {selectedUser.email})
                  </p>
                </div>
              </div>
              <p className="text-[#64748b] text-sm mb-6">
                {t('admin.deleteWarning')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-[#1c2631] rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
                >
                  {submitting ? t('admin.deleting') : t('admin.deleteUser')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPortal;
