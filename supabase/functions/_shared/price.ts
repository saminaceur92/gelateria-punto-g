// Ricalcolo prezzo LATO SERVER dell'ordine torta, leggendo i prezzi dalle tabelle
// Supabase. Il frontend manda solo la configurazione: il totale NON si fida mai del client.
//
// Deve restare allineato alla logica del frontend (CakeConfigurator `total`):
//   prezzo_base(tipo) + supplemento(dimensione+forma+base+farcitura+copertura)
//   + 2€ per ogni gusto oltre il primo + 1€ candelina + 5€ foto
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CakeConfig {
  type?: string;
  shape?: string;
  sizeId?: string;
  baseId?: string;
  fillingId?: string;
  coveringId?: string;
  decoration?: string;
  flavors?: { name: string; color?: string }[];
  candle?: boolean;
  photo?: unknown; // url o flag: se presente, +5€
  delivery?: boolean; // consegna a domicilio +4€
  message?: string;
  occasion?: string;
}

async function priceOf(
  supabase: SupabaseClient,
  table: string,
  column: string,
  id?: string,
): Promise<number> {
  if (!id) return 0;
  const { data } = await supabase.from(table).select(column).eq('id', id).maybeSingle();
  const v = data ? (data as Record<string, unknown>)[column] : 0;
  return typeof v === 'number' ? v : 0;
}

async function nameOf(
  supabase: SupabaseClient,
  table: string,
  id?: string,
  col = 'nome',
): Promise<string> {
  if (!id) return '';
  const { data } = await supabase.from(table).select(col).eq('id', id).maybeSingle();
  return data ? String((data as Record<string, unknown>)[col] ?? '') : '';
}

export async function computeOrder(supabase: SupabaseClient, config: CakeConfig) {
  const [tipoBase, dim, forma, base, farc, cop] = await Promise.all([
    priceOf(supabase, 'tipi_torta', 'prezzo_base', config.type),
    priceOf(supabase, 'dimensioni', 'supplemento', config.sizeId),
    priceOf(supabase, 'forme', 'supplemento', config.shape),
    priceOf(supabase, 'basi', 'supplemento', config.baseId),
    priceOf(supabase, 'farciture', 'supplemento', config.fillingId),
    priceOf(supabase, 'coperture', 'supplemento', config.coveringId),
  ]);

  const nFlavors = Array.isArray(config.flavors) ? config.flavors.length : 0;
  let euros = tipoBase + dim + forma + base + farc + cop;
  if (nFlavors > 1) euros += (nFlavors - 1) * 2;
  if (config.candle) euros += 1;
  if (config.photo) euros += 5;
  if (config.delivery) euros += 4; // consegna a domicilio (DELIVERY_FEE)

  const amountCents = Math.round(euros * 100);

  // Riepilogo leggibile per Stripe e per la notifica Telegram
  const [tipoNome, sizeEt, formaNome] = await Promise.all([
    nameOf(supabase, 'tipi_torta', config.type),
    nameOf(supabase, 'dimensioni', config.sizeId, 'etichetta'),
    nameOf(supabase, 'forme', config.shape),
  ]);
  const flavorNames = (config.flavors ?? []).map((f) => f.name).join(', ');
  const summary = [
    tipoNome && `${tipoNome}`,
    formaNome && `forma ${formaNome.toLowerCase()}`,
    sizeEt && sizeEt,
    flavorNames && `gusti: ${flavorNames}`,
  ].filter(Boolean).join(' · ');

  return { amountCents, summary };
}
