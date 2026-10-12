import type { OrderStatus, PaymentStatus } from './status';
import type { ThemePreset } from '../server/db/schema';

export type { ThemePreset };

export type OrderChannel = 'dine_in' | 'takeaway';
export type PaymentMethod = 'in_person' | 'online';
export type CallKind = 'waiter' | 'bill';

export type OrderDetailOption = { name: string; priceDelta: number };

export type OrderDetailItem = {
	id: number;
	name: string;
	qty: number;
	unitPrice: number;
	lineTotal: number;
	note: string | null;
	options: OrderDetailOption[];
};

export type OrderDetail = {
	id: string;
	publicCode: string;
	status: OrderStatus;
	channel: OrderChannel;
	tableNumber: number | null;
	paymentMethod: PaymentMethod;
	paymentStatus: PaymentStatus;
	subtotal: number;
	taxAmount: number;
	serviceAmount: number;
	total: number;
	note: string | null;
	createdAt: number;
	updatedAt: number;
	items: OrderDetailItem[];
	events: { toStatus: OrderStatus; at: number }[];
};

export type PanelCall = { id: number; tableNumber: number; kind: CallKind; createdAt: number };

export type PanelSnapshot = { orders: OrderDetail[]; calls: PanelCall[] };

export type MenuOption = { id: number; name: string; priceDelta: number; isAvailable: boolean };

export type MenuGroup = {
	id: number;
	name: string;
	kind: 'single' | 'multi';
	required: boolean;
	minSelect: number;
	maxSelect: number;
	options: MenuOption[];
};

export type MenuItem = {
	id: number;
	name: string;
	description: string | null;
	basePrice: number;
	isAvailable: boolean;
	isNew: boolean;
	isBestseller: boolean;
	tags: string[];
	allergens: string[];
	groups: MenuGroup[];
};

export type MenuCategory = { id: number; name: string; items: MenuItem[] };

export type CafeInfo = {
	name: string;
	tagline: string | null;
	primaryColor: string;
	theme: ThemePreset;
	currencyUnit: 'toman' | 'rial';
	orderingEnabled: boolean;
	requireApproval: boolean;
	taxPercent: number;
	servicePercent: number;
	menuLayout: 'list' | 'grid';
	cornerStyle: 'sharp' | 'soft' | 'round';
	welcomeMessage: string | null;
	faDigits: boolean;
	secondLanguage: boolean;
	workingHours: string | null;
	enableOnlinePay: boolean;
	enableInPersonPay: boolean;
	enableTakeaway: boolean;
	enableRatings: boolean;
};
