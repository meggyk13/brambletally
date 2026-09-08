// The single supporter-tier check. Today it is just the plan column; when
// Stripe lands it also checks subscription status / current_period_end.
export const isSupporter = (user) => !!user && user.plan === 'supporter';
