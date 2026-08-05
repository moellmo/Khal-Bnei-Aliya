export type YamimNoraimMembershipType = "member" | "non_member";
export type YamimNoraimPricingOption =
  | "rosh_hashana"
  | "yom_kippur"
  | "both";

export type YamimNoraimSeatCounts = {
  roshHashanaMenSeats: number;
  roshHashanaWomenSeats: number;
  yomKippurMenSeats: number;
  yomKippurWomenSeats: number;
};

export type YamimNoraimPricingSettings = {
  member_rosh_hashana_price: number;
  member_yom_kippur_price: number;
  member_both_price: number;
  nonmember_rosh_hashana_base_price: number;
  nonmember_yom_kippur_base_price: number;
  nonmember_both_base_price: number;
  nonmember_additional_seat_price: number;
};

export type YamimNoraimPrice = {
  option: YamimNoraimPricingOption;
  totalAmount: number;
  baseAmount: number;
  additionalAmount: number;
  totalSeatsForOption: number;
  label: string;
};

function money(value: number) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
}

export function getYamimNoraimPricingOption(
  counts: YamimNoraimSeatCounts
): YamimNoraimPricingOption {
  const hasRoshHashana =
    counts.roshHashanaMenSeats + counts.roshHashanaWomenSeats > 0;
  const hasYomKippur =
    counts.yomKippurMenSeats + counts.yomKippurWomenSeats > 0;

  if (hasRoshHashana && hasYomKippur) return "both";
  if (hasYomKippur) return "yom_kippur";
  return "rosh_hashana";
}

export function calculateYamimNoraimPrice({
  membershipType,
  counts,
  settings,
}: {
  membershipType: YamimNoraimMembershipType;
  counts: YamimNoraimSeatCounts;
  settings: YamimNoraimPricingSettings;
}): YamimNoraimPrice {
  const option = getYamimNoraimPricingOption(counts);
  const roshHashanaSeats =
    counts.roshHashanaMenSeats + counts.roshHashanaWomenSeats;
  const yomKippurSeats =
    counts.yomKippurMenSeats + counts.yomKippurWomenSeats;
  const totalSeatsForOption =
    option === "both"
      ? roshHashanaSeats + yomKippurSeats
      : option === "yom_kippur"
        ? yomKippurSeats
        : roshHashanaSeats;

  const isMember = membershipType === "member";
  const baseAmount =
    option === "both"
      ? isMember
        ? settings.member_both_price
        : settings.nonmember_both_base_price
      : option === "yom_kippur"
        ? isMember
          ? settings.member_yom_kippur_price
          : settings.nonmember_yom_kippur_base_price
        : isMember
          ? settings.member_rosh_hashana_price
          : settings.nonmember_rosh_hashana_base_price;
  const additionalAmount = isMember
    ? 0
    : Math.max(0, totalSeatsForOption - 2) *
      settings.nonmember_additional_seat_price;
  const totalAmount = money(baseAmount + additionalAmount);
  const membershipLabel = isMember ? "Member" : "Non-member";
  const optionLabel =
    option === "both"
      ? "Both holidays"
      : option === "yom_kippur"
        ? "Yom Kippur"
        : "Rosh Hashana";

  return {
    option,
    totalAmount,
    baseAmount: money(baseAmount),
    additionalAmount: money(additionalAmount),
    totalSeatsForOption,
    label: `${membershipLabel} · ${optionLabel}`,
  };
}
