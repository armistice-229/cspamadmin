const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["entree", "sortie"],
      required: true,
    },
    reference: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    montant: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    // Année scolaire concernée par le mouvement de caisse. Obligatoire pour
    // pouvoir distinguer proprement les paiements 2024-2025 des paiements
    // 2025-2026 sans dépendre du texte libre du champ "motifs".
    anneeScolaire: {
      type: String,
      required: true,
      trim: true,
    },
    // --- Pour une entrée (paiement scolarité par ex)
    eleve: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Eleve",
    },
    //Snapshot du nom de l'élève au moment de la transaction
    nomEleve: {
      type: String,
      trim: true,
    },
    recu: {
      type: String, // numéro de reçu unique
      trim: true,
    },
    motifs: {
      type: String, // ex: frais d’inscription, scolarité, etc.
      trim: true,
    },

    // --- Pour une sortie (dépense)
    categorie: {
      type: String, // ex: achat matériel, salaire, entretien
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // --- Info utilisateur
    createdBy: { type: String, required: true },  // snapshot du nom/prénom de l’agent caisse
  },
  { timestamps: true, versionKey: false });
// ✅ Index unique sur "recu" seulement si type = "entree"
TransactionSchema.index(
  { recu: 1 },
  { unique: true, partialFilterExpression: { type: "entree" } }
);
TransactionSchema.index({ eleve: 1, anneeScolaire: 1 });
TransactionSchema.index({ anneeScolaire: 1, date: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
