const mongoose = require("mongoose");

const EleveSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    prenom: { type: String, required: true, trim: true },
    dateNaissance: { type: String, trim: true },
    lieuNaissance: { type: String, trim: true },
    sexe: { type: String, enum: ["M", "F"], required: true },
    contact: {
      type: String,
      trim: true,
      match: [/^[+\d][\d\s\-()]{6,20}$/, "Numéro de contact invalide"]
    },
    matricule: { type: String, trim: true },
    classe: { type: String, required: true, trim: true },
    anneeScolaire: { type: String, required: true, trim: true },
    // Permet de relier deux fiches du même élève sur deux années différentes
    // (ex: fiche 2024-2025 -> fiche 2025-2026 après passage en classe supérieure).
    // Rempli automatiquement lors d'une opération de "passage à l'année suivante".
    eleveAnneePrecedente: { type: mongoose.Schema.Types.ObjectId, ref: "Eleve", default: null }
  },
  { timestamps: true, versionKey: false }
);

// Index utiles (recherche par classe+année, ou recherche d'un élève précis)
EleveSchema.index({ classe: 1, anneeScolaire: 1 });
EleveSchema.index({ nom: 1, prenom: 1, classe: 1, anneeScolaire: 1 });

// ⚠️ Le matricule est un identifiant permanent de l'élève : il DOIT pouvoir se
// répéter d'une année sur l'autre (nouvelle fiche = nouvelle anneeScolaire).
// On le rend donc unique seulement PAR année, plus jamais globalement.
EleveSchema.index(
  { matricule: 1, anneeScolaire: 1 },
  { unique: true, sparse: true }
);

const Eleve = mongoose.model("Eleve", EleveSchema);
module.exports = Eleve;
