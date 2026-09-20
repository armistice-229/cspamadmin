/**
 * Script de migration à exécuter UNE SEULE FOIS, avant de déployer le code
 * "multi-année", sur la base de données de PRODUCTION.
 *
 * ⚠️ FAIRE UNE SAUVEGARDE AVANT (mongodump) — voir instructions dans le README.
 *
 * Ce script :
 *  1. Renseigne "anneeScolaire" sur toutes les transactions existantes qui ne
 *     l'ont pas encore (toutes les transactions actuelles sont censées être
 *     celles de l'année 2024-2025, puisque c'est la seule année qui existait
 *     jusqu'ici).
 *  2. Supprime l'ancien index unique global sur "matricule" (s'il existe) et
 *     laisse Mongoose recréer le nouvel index composé (matricule + anneeScolaire)
 *     au démarrage du serveur.
 *  3. Initialise le paramètre "anneeScolaireActive" à la nouvelle année.
 *
 * Utilisation :
 *   ANNEE_PRECEDENTE=2024-2025 ANNEE_NOUVELLE=2025-2026 node scripts/migration-multi-annee.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Transaction = require("../models/OperationCaisse");
const Eleve = require("../models/Eleve");
const { setAnneeActive } = require("../models/Parametre");

const ANNEE_PRECEDENTE = process.env.ANNEE_PRECEDENTE || "2024-2025";
const ANNEE_NOUVELLE = process.env.ANNEE_NOUVELLE || "2025-2026";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connecté à MongoDB");

  // 1) Backfill anneeScolaire sur les transactions existantes
  const resultTransactions = await Transaction.updateMany(
    { anneeScolaire: { $exists: false } },
    { $set: { anneeScolaire: ANNEE_PRECEDENTE } }
  );
  console.log(
    `📌 ${resultTransactions.modifiedCount} transaction(s) mise(s) à jour avec anneeScolaire="${ANNEE_PRECEDENTE}"`
  );

  // 2) Nettoyer l'ancien index unique global sur matricule (s'il existe encore)
  try {
    await Eleve.collection.dropIndex("matricule_1");
    console.log("📌 Ancien index unique 'matricule_1' supprimé.");
  } catch (err) {
    if (err.codeName === "IndexNotFound") {
      console.log("ℹ️  Aucun ancien index 'matricule_1' à supprimer (déjà propre).");
    } else {
      throw err;
    }
  }
  // Recréer explicitement le nouvel index composé tout de suite (Mongoose le
  // ferait aussi tout seul au prochain démarrage du serveur, mais autant être sûr)
  await Eleve.syncIndexes();
  console.log("📌 Nouvel index composé (matricule + anneeScolaire) synchronisé.");

  // 3) Initialiser l'année active
  await setAnneeActive(ANNEE_NOUVELLE);
  console.log(`📌 Année scolaire active définie sur "${ANNEE_NOUVELLE}"`);

  console.log("🎉 Migration terminée avec succès.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("❌ Erreur pendant la migration :", err);
  process.exit(1);
});
