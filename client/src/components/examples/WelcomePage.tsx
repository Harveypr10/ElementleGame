import { WelcomePage } from '../WelcomePage';

export default function WelcomePageExample() {
  return <WelcomePage onPlayWithoutSignIn={() => console.log('Play without sign in')} />;
}
