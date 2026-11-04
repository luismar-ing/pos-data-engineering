import { addNetworkStateListener } from 'expo-network';
import { AppState } from 'react-native';
import { useSessionStore } from '../../shared/store/sessionStore';
import { API_URL } from '../config';
import { createConnectivity, probeServer } from './connectivity';

const setOnline = (online: boolean) => useSessionStore.getState().setOnlineStatus(online);

const connectivity = createConnectivity({
  probe: () => probeServer(API_URL, fetch),
  setOnline,
  timers: { set: setInterval, clear: (id) => clearInterval(id as ReturnType<typeof setInterval>) },
});

/** Acción a ejecutar cada vez que la app pasa de sin conexión a en línea (SPEC-006 RF-7). */
export const onReconnect = connectivity.onReconnect;

let started = false;

/** Arranca el monitor de conectividad (SPEC-006). Llamar una vez, tras abrir la BD. */
export function startConnectivityMonitor(): void {
  if (started) return;
  started = true;

  useSessionStore.subscribe((state, prev) => connectivity.handleChange(prev.isOnline, state.isOnline));

  // RF-2, RNF-1: la red del teléfono solo dispara la comprobación; sin red se marca al momento.
  addNetworkStateListener(({ isConnected }) => {
    if (isConnected === false) setOnline(false);
    else void connectivity.check();
  });
  AppState.addEventListener('change', (status) => {
    if (status === 'active') void connectivity.check();
  });

  void connectivity.check();
}
