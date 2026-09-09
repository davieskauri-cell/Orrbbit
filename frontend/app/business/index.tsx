import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";

export default function BusinessIndex() {
  const { token, user, loading } = useAuth();
  if (loading) return null;
  if (token && user?.account_type === "business") return <Redirect href="/business/dashboard" />;
  return <Redirect href="/business/login" />;
}
