/** Hora local corta (18:05) para cabeceras y resúmenes. */
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
