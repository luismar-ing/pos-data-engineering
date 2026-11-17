import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/** Carga de una vista del panel al enfocarla, con error y "ocupado" (mismo patrón que Ventas y Stock de SPEC-013). */
export function usePanelData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await fetcher());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [fetcher]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return { data, error, busy, load };
}

/** Confirmación explícita de una acción del panel (SPEC-014 RF-2). */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
