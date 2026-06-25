const SUPPORT_ERROR_FIELD_ORDER = [
  'name',
  'phone',
  'email',
  'issue',
  'priority',
  'description',
  'files',
];

export const getFirstSupportErrorField = (errors = {}) => {
  for (const field of SUPPORT_ERROR_FIELD_ORDER) {
    if (errors[field]) {
      return field;
    }
  }

  return null;
};

export { SUPPORT_ERROR_FIELD_ORDER };
