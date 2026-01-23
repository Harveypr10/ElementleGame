export function initializeRevenueCat(): Promise<void>;
export function logInRevenueCat(userId: string): Promise<{ success: boolean; isPro?: boolean; customerInfo?: any; error?: any }>;
export function logOutRevenueCat(): Promise<{ success: boolean; customerInfo?: any; error?: any }>;
export function checkProSubscription(): Promise<boolean>;
export function getOfferings(): Promise<any>;
export function purchasePackage(pkg: any): Promise<{ success: boolean; isPro?: boolean; customerInfo?: any; productIdentifier?: string; cancelled?: boolean; error?: any }>;
export function restorePurchases(): Promise<{ success: boolean; isPro?: boolean; customerInfo?: any; error?: any }>;
export function getCustomerInfo(): Promise<any>;
export function syncSubscriptionToDatabase(supabaseClient: any): Promise<{ success: boolean; data?: any; error?: string }>;
