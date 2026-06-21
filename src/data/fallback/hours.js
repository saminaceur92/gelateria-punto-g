// Orari di apertura — COPIA DI SICUREZZA (fallback)
// Usati solo se Airtable non è raggiungibile/configurato. Vedi GESTIONE-MENU.md.
// La fonte normale è la tabella "Orari" su Airtable.

export const openingHours = [
  { day: 'Lun', hours: 'Chiuso' },
  { day: 'Mar', hours: '15:00 – 23:00' },
  { day: 'Mer', hours: '15:00 – 23:00' },
  { day: 'Gio', hours: '15:00 – 23:00' },
  { day: 'Ven', hours: '15:00 – 23:30' },
  { day: 'Sab', hours: '14:30 – 23:30' },
  { day: 'Dom', hours: '14:30 – 23:00' },
];
