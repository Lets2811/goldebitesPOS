import { AdminScreen } from './AdminScreen';
import { NoticeBanner } from './NoticeBanner';
import { ChatScreen } from './ChatScreen';
import { HomeScreen } from './HomeScreen';
import { useRoute } from './route';
import { VoiceScreen } from './VoiceScreen';

/**
 * There is no sign-in screen: the app opens on the menu. It is linked to a
 * business by opening a QR or link from the POS (or by saying the code in the
 * first conversation), once per device; from then on the connection is
 * checked quietly and kept until the person signs out.
 */
export function App() {
  const route = useRoute();

  return (
    <>
      <NoticeBanner />
      {route === 'home' && <HomeScreen />}
      {route === 'voice' && <VoiceScreen />}
      {route === 'admin' && <AdminScreen />}
      {/* The chat stays mounted while hidden so going back to the menu does
          not discard the conversation or interrupt an answer in progress. */}
      <ChatScreen hidden={route !== 'chat'} />
    </>
  );
}
