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
    matricule: { type: String, trim: true, unique: true, sparse: true },
    classe: { type: String, required: true, trim: true },
    anneeScolaire: { type: String, required: true, trim: true }
  },
  { timestamps: true, versionKey: false }
);

// Index utiles (recherche par classe+année, ou recherche d'un élève précis)
EleveSchema.index({ classe: 1, anneeScolaire: 1 });
EleveSchema.index({ nom: 1, prenom: 1, classe: 1, anneeScolaire: 1 });

const Eleve = mongoose.model("Eleve", EleveSchema);
module.exports = Eleve;
