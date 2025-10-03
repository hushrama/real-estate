# RealEstate Mobile App

React Native mobile application built with Expo and TypeScript for the RealEstate platform.

## 📱 Features

- **Authentication**: Email/password sign-in and sign-up
- **Buyer Mode**: Browse available properties, save favorites, make requests
- **Seller Mode**: List properties, manage listings, respond to requests
- **Push Notifications**: Real-time notifications for new requests
- **Image Upload**: Multiple property images with camera/gallery support
- **Responsive UI**: Clean, modern design with proper navigation

## 🛠️ Tech Stack

- **Framework**: Expo SDK 50
- **Language**: TypeScript
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Backend**: Supabase (PostgreSQL + Storage + Edge Functions)
- **Animations**: React Native Reanimated
- **Notifications**: Expo Notifications

## 📁 Project Structure

```
mobile/
├── src/
│   ├── api/
│   │   └── supabase.ts              # Supabase client configuration
│   ├── components/
│   │   ├── PropertyCard.tsx         # Property list item component
│   │   ├── ImageCarousel.tsx        # Image carousel for property details
│   │   ├── BottomSheet.tsx          # Modal bottom sheet component
│   │   └── PrimaryButton.tsx        # Reusable button component
│   ├── hooks/
│   │   ├── useAuth.ts               # Authentication hook
│   │   └── useProperties.ts         # Property data management hook
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Main navigation structure
│   ├── screens/
│   │   ├── AuthScreen.tsx           # Login/signup screen
│   │   ├── BuyerHomeScreen.tsx      # Buyer property listings
│   │   ├── SellerHomeScreen.tsx     # Seller property management
│   │   ├── PropertyDetailsScreen.tsx # Property details view
│   │   ├── LikesScreen.tsx          # Saved/favorite properties
│   │   ├── RequestsScreen.tsx       # Property requests
│   │   ├── ProfileScreen.tsx        # User profile
│   │   └── AddPropertyScreen.tsx    # Create new property listing
│   ├── store/
│   │   └── authStore.ts             # Global auth state (Zustand)
│   ├── types/
│   │   └── index.ts                 # TypeScript type definitions
│   └── utils/
│       ├── imageUpload.ts           # Image picker utilities
│       └── notifications.ts         # Push notification setup
├── assets/                          # Images, fonts, etc.
├── .env.example                     # Environment variable template
├── app.json                         # Expo configuration
├── App.tsx                          # Root component
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator
- Physical device with Expo Go app (optional)

### Installation

1. **Install dependencies:**

```bash
cd mobile
npm install
```

2. **Configure environment variables:**

Create a `.env` file in the mobile directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in:
- Supabase Dashboard → Project Settings → API
- Or in the backend project's `.env` file

3. **Start the development server:**

```bash
npm start
```

This will open the Expo Dev Tools in your browser.

### Running the App

#### On iOS Simulator (macOS only):

```bash
npm run ios
```

#### On Android Emulator:

```bash
npm run android
```

#### On Physical Device:

1. Install the Expo Go app from App Store or Google Play
2. Scan the QR code shown in the terminal or Expo Dev Tools
3. The app will load on your device

## 🔧 Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser (limited support)
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

## 🔐 Authentication

The app uses Supabase Auth with email/password authentication.

### Sign Up Flow:
1. User enters email, password, and full name
2. Account created in Supabase Auth
3. Profile created in `profiles` table with default role `buyer`
4. User automatically logged in

### Sign In Flow:
1. User enters email and password
2. Supabase validates credentials
3. User profile fetched from database
4. Navigation switches based on user role (buyer/seller)

## 📊 State Management

### Global State (Zustand)
- **Auth Store** (`authStore.ts`): User authentication state, profile data

### Server State (React Query)
- **Properties**: Property listings with caching and automatic refetching
- **Requests**: Property requests and status updates

## 🎨 UI Components

### PropertyCard
Displays property information in a card format with:
- Primary image or placeholder
- Title, price, location
- Bedroom, bathroom, square footage
- Status badge (available, requested, sold)

### ImageCarousel
Horizontal scrollable image gallery for property photos.

### BottomSheet
Modal component that slides up from the bottom for actions/forms.

### PrimaryButton
Customizable button with loading state and variants (primary, secondary, danger).

## 📱 Push Notifications

### Setup:
1. Physical device required (notifications don't work in simulator)
2. User grants notification permissions on first launch
3. Expo Push Token registered and saved to user profile
4. Sellers receive notifications when buyers make requests

### Testing:
Use the Expo Push Notification Tool: https://expo.dev/notifications

## 🖼️ Image Upload

The app supports:
- Selecting images from photo library
- Taking photos with camera
- Multiple image upload for properties
- Image compression for optimal performance

Images are stored in Supabase Storage in the `properties` bucket.

## 🧪 Testing

Currently, the project is set up for manual testing. To test:

1. **Authentication**: Sign up → sign in → sign out
2. **Buyer Flow**: Browse properties → view details → like → make request
3. **Seller Flow**: Add property → upload images → manage requests
4. **Notifications**: Make request → check seller receives push notification

## 🔧 Troubleshooting

### "Cannot connect to Metro bundler"
- Ensure the development server is running (`npm start`)
- Check that your device/emulator is on the same network
- Try `expo start -c` to clear cache

### "Missing Supabase environment variables"
- Verify `.env` file exists in the mobile directory
- Ensure environment variables start with `EXPO_PUBLIC_`
- Restart the Expo development server after changing `.env`

### "Push notifications not working"
- Use a physical device (not simulator)
- Check notification permissions in device settings
- Verify Expo Push Token is saved in user profile

### TypeScript errors
- Run `npm run type-check` to see all errors
- Ensure all dependencies are installed
- Check that `tsconfig.json` paths are correctly configured

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [TanStack Query](https://tanstack.com/query/latest/docs/react/overview)
- [React Native](https://reactnative.dev/)

## 🤝 Contributing

1. Follow the existing code style
2. Use TypeScript for all new files
3. Add proper types (no `any` types)
4. Test on both iOS and Android before submitting
5. Run linting and type checking

## 📄 License

Private - RealEstate Platform

---

**Need Help?** Check the main project README or contact the development team.
