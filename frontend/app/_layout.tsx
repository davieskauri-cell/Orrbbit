import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { applyGlobalFont } from "@/src/lib/global-font";
import { AuthProvider } from "@/src/context/AuthContext";
import { AppProvider } from "@/src/context/AppContext";
import PingModal from "@/src/components/PingModal";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();
applyGlobalFont();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [fontsLoaded] = useFonts({
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
  });

  useEffect(() => {
    if ((loaded || error) && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, fontsLoaded]);

  if ((!loaded && !error) || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.surface },
              }}
            >
              <Stack.Screen name="vibe" options={{ presentation: "modal" }} />
              <Stack.Screen name="person/[id]" options={{ presentation: "modal" }} />
              <Stack.Screen name="match" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="meetup" options={{ presentation: "fullScreenModal" }} />
            </Stack>
            <PingModal />
          </AppProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
