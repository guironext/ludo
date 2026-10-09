import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

// /api/invitations is intentionally NOT protected here: the route returns
// JSON 401 { invites: [] } when unsigned, so the client poll never hits a
// Clerk HTML redirect that would throw "Failed to fetch".
const isProtected = createRouteMatcher([
  "/joueur(.*)",
  "/apres-connexion(.*)",
  "/admin(.*)",
  "/maison(.*)",
  "/portefeuille(.*)",
  "/salon(.*)",
  "/api/partie(.*)",
  "/api/presence(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect()
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
