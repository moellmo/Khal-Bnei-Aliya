const DEFAULT_EMAIL_SENDER =
  "Khal Bnei Aliya <notifications@send.khalbneialiya.com>";

function cleanConfiguredValue(value: string) {
  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");

  if (/^<[^<>]+>$/.test(unquoted)) {
    return unquoted.slice(1, -1).trim();
  }

  return unquoted;
}

export function getEmailSender(...names: string[]) {
  for (const name of names) {
    const value = cleanConfiguredValue(process.env[name] || "");

    if (
      /<[^<>\s]+@[^<>\s]+>/.test(value) ||
      /^[^<>\s]+@[^<>\s]+$/.test(value)
    ) {
      return value;
    }
  }

  return DEFAULT_EMAIL_SENDER;
}
