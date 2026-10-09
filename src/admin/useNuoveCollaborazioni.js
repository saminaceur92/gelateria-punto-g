import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { contaNuoveCollaborazioni } from '../lib/collabora';

/**
 * Quante proposte di collaborazione aspettano di essere lette: è il numero
 * sulla scheda "🤝 Collaborazioni". Solo per i titolari, gli unici che le
 * vedono (la RLS lo garantisce comunque: per gli altri il conto è zero).
 *
 * Si ricarica a ogni cambio di scheda e, come per gli ordini, appena ne
 * arriva una nuova (tempo reale). Ma SENZA suono: il campanello resta agli
 * ordini, che al banco hanno fretta; una proposta può aspettare.
 *
 * Prima della migrazione la tabella non c'è: niente numero e nessun
 * ascolto in tempo reale (non si apre un canale su una tabella che non
 * esiste).
 *
 * @param {boolean} attivo        true se chi è entrato è un titolare
 * @param {string}  schedaAperta  la scheda corrente: quando cambia, si riconta
 * @returns {[number, () => Promise<void>]} il numero e la funzione per ricontare
 */
export default function useNuoveCollaborazioni(attivo, schedaAperta) {
  const [numero, setNumero] = useState(0);
  const [pronta, setPronta] = useState(false); // la tabella esiste (migrazione lanciata)
  const ultima = useRef(0);

  const ricarica = useCallback(async () => {
    const mia = ++ultima.current;
    if (!attivo) {
      setNumero(0);
      setPronta(false);
      return;
    }
    const n = await contaNuoveCollaborazioni();
    if (mia !== ultima.current) return; // ne è partita una più recente: vale quella
    setPronta(n !== null);
    setNumero(n || 0);
  }, [attivo]);

  useEffect(() => {
    ricarica();
  }, [ricarica, schedaAperta]);

  useEffect(() => {
    if (!attivo || !pronta || !supabase) return undefined;
    const canale = supabase
      .channel('dash-nuove-collaborazioni')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collaborazioni' }, () => {
        ricarica();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canale);
    };
  }, [attivo, pronta, ricarica]);

  return [numero, ricarica];
}
