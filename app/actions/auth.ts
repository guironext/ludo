"use server"

import { requireUser } from "@/lib/auth"

export async function exigerUtilisateur() {
  return requireUser()
}
