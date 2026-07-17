export function formatKiddushShabbosLabel(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return `Shabbos, ${new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)}`;
}

export function formatKiddushShabbosLong(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
