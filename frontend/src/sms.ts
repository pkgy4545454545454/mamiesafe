import * as SMS from "expo-sms";
import { Linking, Platform } from "react-native";

import { Contact } from "@/src/api";

// Opens the SMS composer pre-filled to the given contacts (one tap to send).
// Returns "sent"/"cancelled"/"unavailable" — never throws.
export async function sendSmsToContacts(
  contacts: Contact[],
  message: string,
): Promise<"sent" | "cancelled" | "unavailable"> {
  const numbers = contacts.map((c) => c.phone).filter(Boolean);
  if (numbers.length === 0) return "unavailable";

  if (Platform.OS === "web") {
    return "unavailable";
  }

  try {
    const available = await SMS.isAvailableAsync();
    if (!available) {
      // fall back to the sms: URI scheme
      await Linking.openURL(`sms:${numbers.join(",")}?body=${encodeURIComponent(message)}`);
      return "sent";
    }
    const { result } = await SMS.sendSMSAsync(numbers, message);
    return result === "sent" ? "sent" : "cancelled";
  } catch {
    return "unavailable";
  }
}
