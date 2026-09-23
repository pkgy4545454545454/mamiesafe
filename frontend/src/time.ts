import dayjs from "dayjs";
import "dayjs/locale/fr";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);
dayjs.locale("fr");

export function fromNow(iso: string | null | undefined): string {
  if (!iso) return "jamais";
  return dayjs(iso).fromNow();
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dayjs(iso).format("D MMM, HH:mm");
}
