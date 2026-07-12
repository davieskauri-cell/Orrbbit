import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Private test/demo mode. Hidden from public users; unlocked by tapping the
// app version in Profile 7 times. Gates demo login, demo accounts and trial tools.
const KEY = "intro_test_mode";

export async function getTestMode(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setTestMode(on: boolean): Promise<void> {
  if (on) await AsyncStorage.setItem(KEY, "1");
  else await AsyncStorage.removeItem(KEY);
}

export function useTestMode(): [boolean, (on: boolean) => Promise<void>] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    getTestMode().then(setOn);
  }, []);
  const update = useCallback(async (next: boolean) => {
    await setTestMode(next);
    setOn(next);
  }, []);
  return [on, update];
}
