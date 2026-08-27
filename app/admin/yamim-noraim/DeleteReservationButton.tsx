"use client";

type DeleteReservationAction = (
  reservationId: string,
  year: number
) => void | Promise<void>;

export default function DeleteReservationButton({
  action,
  reservationId,
  year,
}: {
  action: DeleteReservationAction;
  reservationId: string;
  year: number;
}) {
  return (
    <form
      action={action.bind(null, reservationId, year)}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this reservation permanently? This cannot be undone."
          )
        ) {
          event.preventDefault();
        }
      }}
      className="mt-2"
    >
      <button
        type="submit"
        className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
    </form>
  );
}
