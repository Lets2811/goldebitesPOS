import { AdminScreen } from './AdminScreen';
import { ChatScreen } from './ChatScreen';
import { HomeScreen } from './HomeScreen';
import { useRoute } from './route';
import { VoiceScreen } from './VoiceScreen';

/**
 * There is no sign-in: the app opens on the menu, and the first conversation
 * (typed or spoken) links it to a business with a code from the POS.
 */
export function App() {
  const route = useRoute();

  return (
    <>
      {route === 'home' && <HomeScreen />}
      {route === 'voice' && <VoiceScreen />}
      {route === 'admin' && <AdminScreen />}
      {/* The chat stays mounted while hidden so going back to the menu does
          not discard the conversation or interrupt an answer in progress. */}
      <ChatScreen hidden={route !== 'chat'} />
    </>
  );
}
