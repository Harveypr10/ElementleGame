# Elementle Mobile App

A React Native mobile game built with Expo, where players guess historical dates of events.

## Features

- 🎮 **Dual Game Modes**: REGION (UK historical events) and USER (personalized categories)
- 📊 **Stats & Streaks**: Track your performance and maintain daily streaks
- 📅 **Archive**: Play past puzzles and fill in missing days
- 🏆 **Badges**: Unlock achievements for milestones
- 👤 **Guest Mode**: Play without an account, convert later
- 🎨 **Dark Mode**: Full dark mode support
- 🔊 **Sound & Haptics**: Immersive feedback
- ♿ **Accessible**: Screen reader support and WCAG compliant

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Backend**: Supabase (PostgreSQL, Authentication, Realtime)
- **State**: React Query + Context API
- **Navigation**: Expo Router (file-based)
- **Sound**: expo-av
- **Haptics**: expo-haptics

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- iOS Simulator (Mac) or Android Emulator
- Expo account (for builds)

### Installation

```bash
# Clone the repository
cd mobile

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start the development server
npx expo start
```

### Running the App

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android

# Web (limited functionality)
npx expo start --web
```

## Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation
│   ├── (auth)/            # Auth screens
│   └── game/              # Game screens
├── components/            # Reusable components
├── contexts/              # React contexts
├── hooks/                 # Custom hooks
├── lib/                   # Utilities and services
├── assets/                # Images, fonts, sounds
└── types/                 # TypeScript types
```

## Key Files

- `app/_layout.tsx` - Root layout with providers
- `hooks/useGameEngine.ts` - Core game logic (692 lines)
- `lib/supabase.ts` - Supabase client setup
- `lib/auth.tsx` - Authentication context
- `TASKS.md` - Development task tracker

## Development

### Code Style

```bash
# Run linter
npm run lint

# Type check
npm run typecheck

# Format code
npm run format
```

### Testing

```bash
# Run E2E tests (Maestro)
maestro test maestro/

# See E2E_TESTING.md for setup
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

## Documentation

- [API Documentation](./API_DOCUMENTATION.md) - Supabase queries and local APIs
- [E2E Testing](./E2E_TESTING.md) - Testing strategy and test flows
- [Deployment Guide](./DEPLOYMENT.md) - Build and release process
- [Final Polish Checklist](./FINAL_POLISH_CHECKLIST.md) - Pre-launch checklist

## Features Roadmap

See [TASKS.md](./TASKS.md) for detailed progress.

**Phase 1** ✅ (Complete)
- Guest mode with data migration
- Error boundaries
- Streak saver flow
- Initial polish

**Phase 2** ✅ (Complete)
- Haptic feedback
- Sound effects
- Visual polish (shadows, skeletons)
- Loading states

**Phase 3** 🚧 (In Progress)
- Test infrastructure
- Performance optimization
- Platform-specific features
- Final documentation

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

Proprietary - All rights reserved

## Support

For issues or questions:
- Email: support@elementle.com
- Website: https://elementle.com/support

## Acknowledgments

- Built with [Expo](https://expo.dev/)
- Backend by [Supabase](https://supabase.com/)
- Icons from [Lucide](https://lucide.dev/)
- Fonts from [Google Fonts](https://fonts.google.com/)
