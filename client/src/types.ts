
export enum UserRole {
  GUEST = 'GUEST',
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  DEV = 'DEV'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  phone?: string;
  address?: string;
  dietaryPreferences?: string;
  stamps?: number; 
  hasCateringDiscount?: boolean; // 10% off next order if previous spent > $1k
}

export interface PackGroup {
  name: string; // e.g., "Choose 4 Proteins"
  limit: number; // e.g., 4
  options: string[]; // e.g., ["Brisket", "Pork", "Sausage"]
}

export interface MenuItem {
  id: string;
  _id?: string; // legacy Mongo id, some server responses still include this
  name: string;
  description: string;
  price: number;
  unit?: string;
  minQuantity?: number;
  preparationOptions?: string[];
  image: string;
  category: 'Burgers' | 'Meats' | 'Sides' | 'Platters' | 'Drinks' | 'Bulk Meats' | 'Catering Packs' | 'Trays' | 'Hot Sides' | 'Cold Sides' | 'Bakery' | 'Service' | 'Family Packs' | 'Rubs & Sauces' | 'Merch' | 'Salads';
  available: boolean;
  availabilityType: 'everyday' | 'specific_date';
  specificDate?: string;
  specificDates?: string[];
  // Pack Logic
  isPack?: boolean;
  packGroups?: PackGroup[];
  // Catering Logic
  availableForCatering?: boolean;
  isCatering?: boolean; // true = catering-only item (not shown on stocktake / cook-day menus)
  cateringCategory?: 'Meat' | 'Side' | 'Extra' | 'Drink' | 'Dessert';
  moq?: number;
  // Stocktake — null/undefined means "not tracked"; a number is the current on-hand count.
  // When stock hits 0 the item auto-marks unavailable for the day.
  stock?: number | null;
}

export interface CateringPackage {
  id: string;
  name: string;
  description: string;
  price: number; // Per Head
  minPax: number;
  meatLimit: number;
  sideLimit: number;
  image: string;
}

export interface CocktailTier {
  id: string;
  name: string;        // e.g. "The Teaser"
  description: string;
  price: number;       // Per person
  pieces: number;      // Total pieces per head
  cold: number;        // Of which cold
  hot: number;         // Of which hot
  substantial: number; // Of which substantial (main-like)
  duration: string;    // e.g. "30–60 min"
  image?: string;      // URL or base64 — shown on the storefront cocktail card
}

export interface FunctionTier {
  id: string;
  name: string;
  description: string;
  price: number;       // Per person
  courses?: string;    // e.g. "2 courses"
  servingStyle?: string; // e.g. "Alternate drop"
  image?: string;      // URL or base64 — shown on the storefront function card
}

export interface CalendarEvent {
  id: string;
  date: string; 
  type: 'ORDER_PICKUP' | 'BLOCKED' | 'PUBLIC_EVENT';
  title: string;
  description?: string; 
  location?: string; 
  time?: string; // Display string e.g. "2pm - 6pm"
  startTime?: string; // "14:00"
  endTime?: string; // "18:00"
  orderId?: string; 
  image?: string; 
  tags?: string[]; 
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  items: { 
    item: MenuItem; 
    quantity: number;
    selectedOption?: string; 
    packSelections?: Record<string, string[]>; // e.g. { "Proteins": ["Brisket", "Brisket"] }
  }[];
  total: number;
  depositAmount?: number; // New field for catering deposits
  status: 'Pending' | 'Awaiting Payment' | 'Paid' | 'Confirmed' | 'Cooking' | 'Ready' | 'Shipped' | 'Completed' | 'Cancelled' | 'Rejected';
  cookDay: string; 
  type: 'TAKEAWAY' | 'CATERING'; 
  pickupTime?: string;
  createdAt: string;
  // New Preferences
  temperature: 'HOT' | 'COLD';
  fulfillmentMethod: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: string;
  deliveryFee?: number;
  // Tracking
  trackingNumber?: string;
  courier?: string;
  // Pop-up collection
  collectionPin?: string;
  pickupLocation?: string;
  discountApplied?: boolean; // If the 10% catering discount was used
  paymentIntentId?: string;
  squareCheckoutId?: string; // Square order ID from checkout link, used for webhook payment matching
}

export interface CookDay {
  id: string;
  date: string;
  location: string;
  isOpen: boolean;
}

export interface SocialPost {
  id: string;
  platform: 'Facebook' | 'Instagram';
  content: string;
  image?: string;
  scheduledFor: string;
  status: 'Draft' | 'Scheduled' | 'Posted';
  hashtags: string[];
}

export interface GalleryPost {
  id: string;
  userId: string;
  userName: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
  approved: boolean; 
  likes: number; // New: Total likes
  likedBy: string[]; // New: IDs of users who liked it
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedOption?: string;
  packSelections?: Record<string, string[]>;
}

export interface RewardPrize {
  id: string;
  title: string;
  image: string;
}

export interface RewardsConfig {
  enabled: boolean;
  programName: string;
  staffPin: string;
  maxStamps: number;
  rewardTitle: string; // Deprecated but kept for fallback
  rewardImage: string; // Deprecated but kept for fallback
  possiblePrizes: RewardPrize[]; // New Prize Pool
  minPurchase?: number; // minimum $ spent to earn a stamp (0 = any purchase)
}

export interface AppSettings {
  maintenanceMode: boolean; 
  
  // -- Images --
  // Home
  heroCateringImage?: string; 
  heroCookImage?: string; 
  homePromoterImage?: string;
  homeScheduleCardImage?: string;
  homeMenuCardImage?: string;
  // Menu
  menuHeroImage?: string;
  // DIY Catering
  diyHeroImage?: string;
  diyCardPackageImage?: string;
  diyCardCuratedImage?: string;
  diyCardCustomImage?: string;
  cateringPackageImages: Record<string, string>;
  // Events
  eventsHeroImage?: string;
  // Promoters
  promotersHeroImage?: string;
  promotersSocialImage?: string;
  // Gallery
  galleryHeroImage?: string;
  // System
  maintenanceImage?: string;
  
  stripeConnected: boolean;
  stripePublicKey?: string;
  squareConnected: boolean;
  // Square Specifics
  squareApplicationId?: string;
  squareLocationId?: string;
  squareAccessToken?: string;
  squareEnvironment?: 'sandbox' | 'production';

  smartPayConnected: boolean; 
  smartPayPublicKey?: string; 
  smartPaySecretKey?: string; 
  smsConnected: boolean;
  facebookConnected: boolean; 
  facebookAppId?: string; 
  facebookPageId?: string; 
  facebookPageAccessToken?: string; 
  instagramBusinessAccountId?: string;
  manualTickerImages: string[]; 
  businessName: string;
  businessAddress: string;
  tagline?: string;
  location?: string;
  adminEmail?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  phone?: string;
  contactEmail?: string;
  subtitle?: string;
  heroHeading?: string;
  heroTagline?: string;          // admin-editable hero tagline on storefront home
  philosophyHeading?: string;    // admin-editable "Our Philosophy" heading
  philosophyBody?: string;       // admin-editable body copy under the heading
  mapsUrl?: string;
  logoUrl: string;
  adminUsername?: string;
  adminPassword?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  rewards: RewardsConfig;
  cateringPackages?: CateringPackage[];
  // Self Service tab (Build Your Self Service Order): lists drive the per-kg / per-tray pickers.
  // Leave empty to use the Hughesey Que defaults baked into StorefrontCatering.js.
  // Append " *" to a meat name to flag it as a surcharge item (e.g. "Pork Belly *").
  cateringSelfServiceMeats?: string[];
  cateringSelfServiceSides?: string[];
  // Optional desserts list for the Self Service builder. Empty array or
  // undefined hides the Desserts section entirely on the storefront.
  cateringSelfServiceDesserts?: string[];
  // Price + unit lookup keyed by item name (matches the strings in the
  // three *SelfService* lists above). When present, the storefront shows
  // '$75 / kg' next to each item and the admin form shows a price input
  // per row. Missing entries fall through to 'POA' on the storefront.
  cateringSelfServicePrices?: {
    meats?: Record<string, { price: number; unit: string }>;
    sides?: Record<string, { price: number; unit: string }>;
    desserts?: Record<string, { price: number; unit: string }>;
  };
  // Per-dessert image override keyed by exact dessert name (or its cleaned
  // form, stripped of trailing ' *'). Stores either a full URL or a base64
  // data URL from the admin file picker. Missing entries render a Cake-icon
  // placeholder on the storefront.
  cateringSelfServiceDessertImages?: Record<string, string>;
  // Feasting Table "How We Set Up" info block on the storefront catering page.
  feastingTableInfo?: { bullets: string[] };
  // Host Rewards banner shown above the tab bar on the storefront catering page.
  // body supports **bold** markdown (rendered as <strong>). Set enabled=false to hide.
  // thresholdAmount + discountPercent drive both the banner copy AND the
  // admin loyalty toggle in OrderManager — keep them in one place so the
  // promise on the storefront matches what admin actually applies.
  hostRewards?: {
    enabled?: boolean;
    title?: string;
    body?: string;
    thresholdAmount?: number; // default 1000 — past-catering-spend threshold to qualify
    discountPercent?: number; // default 10 — % off the next order once eligible
  };
  // FEED THE WHOLE MOB hero shown at the top of the Pre-Order / Menu page.
  // Promotes catering packs. titleLine2 gets a pink/purple gradient treatment
  // on the storefront. Set enabled=false to hide the entire hero block.
  feedTheMob?: {
    enabled?: boolean;
    badge?: string;
    titleLine1?: string;
    titleLine2?: string;
    body?: string;
    ctaLabel?: string;
  };
  // Cocktail + Function menu tiers (storefront /catering page sub-tabs).
  // Cocktail tiers fall back to hard-coded defaults when empty; function tiers show
  // a "coming soon" empty state until admin adds at least one tier.
  cocktailMenuTiers?: CocktailTier[];
  functionMenuTiers?: FunctionTier[];
  // Email Settings
  emailSettings?: {
    enabled: boolean;
    provider: 'smtp' | 'sendgrid' | 'mailgun';
    apiKey?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    fromEmail: string;
    fromName: string;
    adminEmail: string;
  };
  smsSettings?: {
    enabled: boolean;
    accountSid: string;
    authToken: string;
    fromNumber: string;
    adminPhone: string;
  };
  invoiceSettings?: {
    paymentUrl: string;
    paymentLabel: string;
    headerColor: string;
    accentColor: string;
    logoUrl: string;
    footerNote: string;
    thankYouMessage: string;
    bankDetails: string;
    smsTemplate: string;
    gstEnabled?: boolean; // defaults to true (GST-registered business)
    gstRate?: number;     // percentage, defaults to 10
  };
}
