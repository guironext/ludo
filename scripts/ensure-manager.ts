import bcrypt from "bcryptjs"
import { prisma } from "../lib/db"
import { HOUSE_PSEUDO, ROLE_JOUEUR, ROLE_MAISON, ROLE_MANAGER, SIGNUP_POKY } from "../lib/rules"

async function main() {
  const pseudo = process.env.MANAGER_PSEUDO?.trim() || "manager"
  const email = process.env.MANAGER_EMAIL?.trim().toLowerCase() || "manager@ludopoky.local"
  const password = process.env.MANAGER_PASSWORD ?? ""
  if (password.length < 8) throw new Error("MANAGER_PASSWORD doit contenir au moins 8 caractères.")

  await prisma.user.updateMany({
    where: { pseudo: { notIn: [HOUSE_PSEUDO, pseudo] } },
    data: { role: ROLE_JOUEUR },
  })
  await prisma.user.updateMany({
    where: { pseudo: HOUSE_PSEUDO },
    data: { role: ROLE_MAISON },
  })

  const existing = await prisma.user.findFirst({
    where: { OR: [{ pseudo }, { email }] },
  })
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { pseudo, email, role: ROLE_MANAGER, adult: true },
    })
    console.log(`Compte manager déjà présent : ${existing.pseudo}`)
    return
  }

  const user = await prisma.user.create({
    data: {
      pseudo,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      poky: SIGNUP_POKY,
      pokyBonus: SIGNUP_POKY,
      lion: 0,
      adult: true,
      role: ROLE_MANAGER,
    },
  })
  await prisma.walletTx.create({
    data: {
      userId: user.id,
      currency: "poky",
      amount: SIGNUP_POKY,
      reason: "bonus de bienvenue",
    },
  })
  console.log(`Compte manager créé : ${user.pseudo}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
