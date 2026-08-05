// Orari di apertura — COPIA DI SICUREZZA (fallback)
// Usati solo se Supabase non è raggiungibile/configurato. Vedi GESTIONE-MENU.md.
// La fonte normale è la tabella "orari" su Supabase: qui teniamo la stessa
// scrittura dell'orario ("11:00-23:00") così il sito non cambia aspetto
// quando passa dai dati live alla copia di sicurezza.

export const openingHours = [
  { day: 'Lun', hours: '11:00-23:00' },
  { day: 'Mar', hours: '11:00-23:00' },
  { day: 'Mer', hours: '11:00-23:00' },
  { day: 'Gio', hours: '11:00-23:00' },
  { day: 'Ven', hours: '11:00-23:00' },
  { day: 'Sab', hours: '11:00-23:00' },
  { day: 'Dom', hours: '11:00-23:00' },
];
