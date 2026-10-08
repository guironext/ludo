import fs from "node:fs"; import crypto from "node:crypto"; import os from "node:os"
import { PrismaClient } from "@prisma/client"
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]))
const KEY = env.CLERK_SECRET_KEY; if(!KEY) throw new Error("CLERK_SECRET_KEY manquant")
const prisma = new PrismaClient()
const cs="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%*-_"
const pw=()=>{let s;do{s=Array.from(crypto.randomBytes(20),b=>cs[b%cs.length]).join("")}while(!(/[A-Z]/.test(s)&&/[a-z]/.test(s)&&/\d/.test(s)&&/[!@#%*\-_]/.test(s)));return s}
async function api(method,path,body){const r=await fetch("https://api.clerk.com/v1"+path,{method,headers:{Authorization:"Bearer "+KEY,"Content-Type":"application/json"},body:body&&JSON.stringify(body)});const j=await r.json().catch(()=>({}));return {ok:r.ok,status:r.status,j}}
async function ensureClerk(email,username,password){
  const f=await api("GET","/users?email_address="+encodeURIComponent(email))
  if(!f.ok) throw new Error("lookup "+f.status)
  if(f.j.length) return {id:f.j[0].id,username:f.j[0].username,existed:true}
  let r=await api("POST","/users",{email_address:[email],username,password,skip_password_checks:false})
  if(!r.ok&&JSON.stringify(r.j).includes("username")) r=await api("POST","/users",{email_address:[email],password,skip_password_checks:false})
  if(!r.ok)throw new Error(email+": "+r.status+" "+JSON.stringify(r.j.errors?.map(e=>e.long_message||e.message)))
  return {id:r.j.id,username:r.j.username,verified:r.j.email_addresses?.[0]?.verification?.status}
}
const out=[]
const pa=pw(), pm=pw()
const a=await ensureClerk("guirogerard@gmail.com","admin",pa)
const house=await prisma.user.findUnique({where:{pseudo:"maison"}}); if(!house) throw new Error("maison introuvable")
const m=await ensureClerk("guironext@gmail.com","maison",pm)
// admin User (role manager = accès /admin)
let au=await prisma.user.findUnique({where:{email:"guirogerard@gmail.com"}})
if(au) au=await prisma.user.update({where:{id:au.id},data:{clerkId:a.id,role:"manager"}})
else { let pseudo="admin"; if(await prisma.user.findUnique({where:{pseudo}})) pseudo="admin_"+crypto.randomBytes(2).toString("hex")
  au=await prisma.user.create({data:{clerkId:a.id,pseudo,email:"guirogerard@gmail.com",poky:0,pokyBonus:0,lion:0,adult:true,role:"manager"}}) }
const before={poky:house.poky,lion:house.lion}
const hu=await prisma.$transaction(async tx=>{const g=await tx.user.findUnique({where:{clerkId:m.id}}); if(g&&g.id!==house.id){await tx.user.update({where:{id:g.id},data:{clerkId:null,email:g.pseudo.toLowerCase()+"+archive@ludo-poky.local"}})} return tx.user.update({where:{id:house.id},data:{clerkId:m.id}})})
if(hu.poky!==before.poky||hu.lion!==before.lion) throw new Error("solde maison modifié ?!")
const file=os.homedir()+"/Desktop/ludo-poky-comptes-PRIVE.txt"
fs.writeFileSync(file,`Baobab Arena - comptes (PRIVE)
Connexion : http://localhost:3000/connexion

ADMIN (rôle manager, accès /admin)
  Email : guirogerard@gmail.com
  Nom d'utilisateur : ${a.username??"(non activé)"}
  Mot de passe : ${a.existed?"(compte Clerk existant : utilise ton mot de passe actuel)":pa}

MAISON (compte de la maison, rôle maison)
  Email : guironext@gmail.com
  Nom d'utilisateur : ${m.username??"(non activé)"}
  Mot de passe : ${m.existed?"ton mot de passe actuel de guironext@gmail.com (ou connexion Google)":pm}

IMPORTANT : change ces mots de passe après ta première connexion, puis supprime ce fichier.
`,{mode:0o600}); fs.chmodSync(file,0o600)
console.log(JSON.stringify({admin:{clerk:a.id,username:a.username,existed:!!a.existed,verified:a.verified,db:{pseudo:au.pseudo,role:au.role}},maison:{clerk:m.id,username:m.username,existed:!!m.existed,verified:m.verified,db:{pseudo:hu.pseudo,role:hu.role,poky:hu.poky,lion:hu.lion,unchanged:true}},file}))
await prisma.$disconnect()
