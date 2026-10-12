export const ORDER_STATUSES = ['awaiting_approval', 'received', 'preparing', 'ready', 'served', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'unpaid_in_person', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ROLES = ['owner', 'cashier', 'kitchen'] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_ACTIONS = ['approve', 'start', 'ready', 'served', 'cancel', 'paid'] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];

export const ACTION_RULES: Record<OrderAction, { from: readonly OrderStatus[]; to: OrderStatus | null; roles: readonly Role[] }> = {
	approve: { from: ['awaiting_approval'], to: 'received', roles: ['owner', 'cashier'] },
	start: { from: ['received'], to: 'preparing', roles: ['owner', 'cashier', 'kitchen'] },
	ready: { from: ['preparing'], to: 'ready', roles: ['owner', 'cashier', 'kitchen'] },
	served: { from: ['ready'], to: 'served', roles: ['owner', 'cashier'] },
	cancel: { from: ['awaiting_approval', 'received', 'preparing', 'ready'], to: 'cancelled', roles: ['owner', 'cashier'] },
	paid: { from: ['awaiting_approval', 'received', 'preparing', 'ready', 'served'], to: null, roles: ['owner', 'cashier'] }
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
	awaiting_approval: 'منتظر تأیید',
	received: 'ثبت شد',
	preparing: 'در حال آماده‌سازی',
	ready: 'آماده است',
	served: 'تحویل شد',
	cancelled: 'لغو شد'
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
	unpaid: 'پرداخت‌نشده',
	unpaid_in_person: 'پرداخت حضوری',
	paid: 'پرداخت شد',
	refunded: 'بازگشت وجه'
};

export const ROLE_LABELS: Record<Role, string> = {
	owner: 'مدیر کافه',
	cashier: 'صندوق',
	kitchen: 'بار و آشپزخانه'
};

export const ACTION_LABELS: Record<OrderAction, string> = {
	approve: 'تأیید سفارش',
	start: 'شروع آماده‌سازی',
	ready: 'آماده شد',
	served: 'تحویل شد',
	cancel: 'لغو سفارش',
	paid: 'پرداخت دریافت شد'
};
