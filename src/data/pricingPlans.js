export const YEARLY_DISCOUNT = 0.2;

export const getYearlyPrice = (monthlyPrice) =>
  Number((monthlyPrice * 12 * (1 - YEARLY_DISCOUNT)).toFixed(2));

export const pricingPlans = [
  {
    id: "free",
    monthlyPrice: 0,
    comparisons: 1,
    featureKeys: ["basicReport", "standardSupport"],
  },
  {
    id: "starter",
    monthlyPrice: 49,
    comparisons: 5,
    featureKeys: ["fullPdfReport", "emailSupport"],
  },
  {
    id: "professional",
    monthlyPrice: 149,
    comparisons: 25,
    featureKeys: ["advancedReports", "prioritySupport"],
    featured: true,
  },
  {
    id: "business",
    monthlyPrice: 399,
    comparisons: 100,
    featureKeys: ["teamAccounts", "prioritySupport"],
  },
];
