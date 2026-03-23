import { MenuItem, CookDay, User, UserRole, AppSettings, CalendarEvent } from './types';

export const LOGO_URL = '/logo.png';
export const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80';

const BBQ_IMGS = {
  burger1: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80',
  burger2: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
  brisketPlate: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=800&q=80',
  mixedPlatter: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
  wholeBrisket: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
  pulledPork: 'https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?auto=format&fit=crop&w=800&q=80',
  porkRibs: 'https://images.unsplash.com/photo-1588347818036-558601350947?auto=format&fit=crop&w=800&q=80',
  wings: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=800&q=80',
  fries: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80',
  salad: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
  slaw: 'https://images.unsplash.com/photo-1625938144755-652e08e359b7?auto=format&fit=crop&w=800&q=80',
  rolls: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
};

export const INITIAL_MENU: MenuItem[] = [
  {
    id: 'b1', name: 'The OG Brisket Burger',
    description: '150g of 12-hour smoked Black Angus brisket, melted American cheddar, house pickles, white onion & signature BBQ sauce on a toasted brioche bun.',
    price: 18, image: BBQ_IMGS.burger1, category: 'Burgers', available: true, availabilityType: 'everyday',
  },
  {
    id: 'b2', name: 'Pulled Pork Burger',
    description: 'Succulent 12hr smoked pork shoulder tossed in house rub, topped with crunchy apple slaw & tangy Carolina gold sauce on a soft milk bun.',
    price: 16, image: BBQ_IMGS.burger2, category: 'Burgers', available: true, availabilityType: 'everyday',
  },
  {
    id: 'm1', name: 'Brisket Plate (200g)',
    description: 'Signature 12-hour smoked Black Angus brisket (200g). Served with house pickles, white onion, and soft white bread.',
    price: 32, image: BBQ_IMGS.brisketPlate, category: 'Meats', available: true, availabilityType: 'everyday',
  },
  {
    id: 'bm1', name: 'Whole Smoked Brisket (Per KG)',
    description: 'Minimum 1kg order. Sliced ready to serve. 12hr smoked over Ironbark.',
    price: 85, unit: 'kg', minQuantity: 1, image: BBQ_IMGS.wholeBrisket,
    category: 'Bulk Meats', available: true, availabilityType: 'everyday',
    availableForCatering: true, cateringCategory: 'Meat',
  },
  {
    id: 'bm2', name: 'Pulled Pork (Per KG)',
    description: 'Juicy, tender pork shoulder smoked for 12 hours and hand-pulled. Includes sauce on the side.',
    price: 65, unit: 'kg', minQuantity: 1, image: BBQ_IMGS.pulledPork,
    category: 'Bulk Meats', available: true, availabilityType: 'everyday',
    availableForCatering: true, cateringCategory: 'Meat',
  },
  {
    id: 'bm3', name: 'Pork Ribs (Half Rack)',
    description: 'Half rack of St. Louis cut pork ribs, smoked low and slow.',
    price: 45, image: BBQ_IMGS.porkRibs, category: 'Bulk Meats', available: true, availabilityType: 'everyday',
    availableForCatering: true, cateringCategory: 'Meat',
  },
  {
    id: 's1', name: 'Apple Slaw',
    description: 'Fresh house-made coleslaw with crisp apple and tangy dressing.',
    price: 8, image: BBQ_IMGS.slaw, category: 'Sides', available: true, availabilityType: 'everyday',
    availableForCatering: true, cateringCategory: 'Side',
  },
  {
    id: 's2', name: 'Seasoned Fries',
    description: 'Crispy golden fries tossed in our house rub seasoning.',
    price: 8, image: BBQ_IMGS.fries, category: 'Sides', available: true, availabilityType: 'everyday',
  },
];

export const INITIAL_COOK_DAYS: CookDay[] = [];
export const INITIAL_EVENTS: CalendarEvent[] = [];

export const INITIAL_ADMIN_USER: User = {
  id: 'admin1', name: 'Admin', email: 'admin@hugheseysque.au',
  role: UserRole.ADMIN, isVerified: true, stamps: 0,
};
export const INITIAL_DEV_USER: User = {
  id: 'dev1', name: 'Dev', email: 'dev@hugheseysque.au',
  role: UserRole.DEV, isVerified: true, stamps: 0,
};

export const INITIAL_SETTINGS: AppSettings = {
  maintenanceMode: false,
  heroCateringImage: '',
  heroCookImage: '',
  homePromoterImage: '',
  homeScheduleCardImage: '',
  homeMenuCardImage: '',
  menuHeroImage: '',
  diyHeroImage: '',
  diyCardPackageImage: '',
  diyCardCuratedImage: '',
  diyCardCustomImage: '',
  cateringPackageImages: { essential: '', pitmaster: '', wholehog: '' },
  eventsHeroImage: '',
  promotersHeroImage: '',
  promotersSocialImage: '',
  galleryHeroImage: '',
  maintenanceImage: '',
  stripeConnected: false,
  squareConnected: false,
  squareApplicationId: '',
  squareLocationId: '',
  smartPayConnected: false,
  smartPayPublicKey: '',
  smartPaySecretKey: '',
  smsConnected: false,
  facebookConnected: false,
  facebookAppId: '',
  facebookPageId: '',
  facebookPageAccessToken: '',
  manualTickerImages: [],
  businessName: 'Hughesys Que',
  businessAddress: 'Yeppoon, QLD',
  tagline: 'Low & Slow BBQ',
  location: 'Yeppoon, QLD',
  adminEmail: 'admin@hugheseysque.au',
  facebookUrl: '',
  instagramUrl: '',
  logoUrl: LOGO_URL,
  adminUsername: 'admin',
  adminPassword: '123',
  rewards: {
    enabled: true,
    programName: 'Que Rewards',
    staffPin: '1234',
    maxStamps: 10,
    rewardTitle: 'Free Pulled Pork Roll',
    rewardImage: BBQ_IMGS.pulledPork,
    possiblePrizes: [
      { id: 'p1', title: 'Free Brisket Burger', image: BBQ_IMGS.burger1 },
      { id: 'p2', title: 'Free Pulled Pork Roll', image: BBQ_IMGS.pulledPork },
      { id: 'p3', title: 'Loaded Fries', image: BBQ_IMGS.fries },
    ],
  },
  cateringPackages: [
    {
      id: 'pkg_essential', name: 'The Essentials',
      description: 'The no-fuss option. Perfect for casual backyard gatherings or office lunches.',
      price: 35, minPax: 10, meatLimit: 2, sideLimit: 2, image: BBQ_IMGS.brisketPlate,
    },
    {
      id: 'pkg_pitmaster', name: 'The Pitmaster',
      description: 'Our crowd favourite. A balanced spread of our best smoked cuts and sides.',
      price: 48, minPax: 10, meatLimit: 3, sideLimit: 3, image: BBQ_IMGS.mixedPlatter,
    },
    {
      id: 'pkg_wholehog', name: 'The Whole Hog',
      description: 'The ultimate BBQ experience. Full variety of meats, sides, and premium additions.',
      price: 65, minPax: 10, meatLimit: 4, sideLimit: 4, image: BBQ_IMGS.wholeBrisket,
    },
  ],
  emailSettings: {
    enabled: false,
    provider: 'smtp',
    fromEmail: 'noreply@hugheseysque.au',
    fromName: 'Hughesys Que',
    adminEmail: 'admin@hugheseysque.au',
  },
  invoiceSettings: {
    paymentUrl: '',
    paymentLabel: 'Pay Now',
    headerColor: '#f59e0b',
    accentColor: '#d97706',
    logoUrl: '',
    footerNote: 'Thank you for your business! Questions? Reply to this email or give us a call.',
    thankYouMessage: "Here's your invoice. Please review the details below and arrange payment at your earliest convenience.",
    bankDetails: '',
    smsTemplate: 'Hi {name}, you have an invoice for ${total} from {business}. Order #{orderNum}.{payLink}\n\nCheers!',
  },
};
