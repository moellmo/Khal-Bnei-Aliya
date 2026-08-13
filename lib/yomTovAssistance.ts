export const assistanceFieldGroups = [
  {
    key: "children_ages_3_8",
    label: "Children Ages 3–8",
    points: 0.33,
  },
  {
    key: "children_ages_9_13",
    label: "Children Ages 9–13",
    points: 0.66,
  },
  {
    key: "age_14_plus",
    label: "Age 14+",
    points: 1,
  },
] as const;

export const assistanceHolidays = [
  { key: "rosh_hashanah", label: "Rosh Hashanah" },
  { key: "first_days_sukkos", label: "First Days Sukkos" },
  { key: "shemini_atzeres", label: "Shemini Atzeres" },
] as const;

export type AssistanceCounts = {
  adultsCount: number;
  childrenUnder3Count: number;
  childrenAges3To8RoshHashanah: number;
  childrenAges3To8FirstDaysSukkos: number;
  childrenAges3To8SheminiAtzeres: number;
  childrenAges9To13RoshHashanah: number;
  childrenAges9To13FirstDaysSukkos: number;
  childrenAges9To13SheminiAtzeres: number;
  age14PlusRoshHashanah: number;
  age14PlusFirstDaysSukkos: number;
  age14PlusSheminiAtzeres: number;
};

const safeCount = (value: number) => Math.max(0, Math.floor(Number(value) || 0));

export function calculateAssistanceTotals(counts: AssistanceCounts) {
  const totalPeopleInFamily =
    Math.max(
      safeCount(counts.childrenAges3To8RoshHashanah),
      safeCount(counts.childrenAges3To8FirstDaysSukkos),
      safeCount(counts.childrenAges3To8SheminiAtzeres)
    ) +
    Math.max(
      safeCount(counts.childrenAges9To13RoshHashanah),
      safeCount(counts.childrenAges9To13FirstDaysSukkos),
      safeCount(counts.childrenAges9To13SheminiAtzeres)
    ) +
    Math.max(
      safeCount(counts.age14PlusRoshHashanah),
      safeCount(counts.age14PlusFirstDaysSukkos),
      safeCount(counts.age14PlusSheminiAtzeres)
    );

  const totalPoints = Number(
    (
      safeCount(counts.childrenAges3To8RoshHashanah) * 0.33 +
      safeCount(counts.childrenAges3To8FirstDaysSukkos) * 0.33 +
      safeCount(counts.childrenAges3To8SheminiAtzeres) * 0.33 +
      safeCount(counts.childrenAges9To13RoshHashanah) * 0.66 +
      safeCount(counts.childrenAges9To13FirstDaysSukkos) * 0.66 +
      safeCount(counts.childrenAges9To13SheminiAtzeres) * 0.66 +
      safeCount(counts.age14PlusRoshHashanah) +
      safeCount(counts.age14PlusFirstDaysSukkos) +
      safeCount(counts.age14PlusSheminiAtzeres)
    ).toFixed(2)
  );

  return { totalPeopleInFamily, totalPoints };
}
