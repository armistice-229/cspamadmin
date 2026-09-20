const mongoose = require("mongoose");

// Une seule "ligne" existera dans cette collection : les réglages globaux de l'école.
// On l'utilise pour stocker l'année scolaire active, afin de ne plus jamais
// coder "2024-2025" en dur dans les routes ou le frontend.
const ParametreSchema = new mongoose.Schema(
  {
    cle: { type: String, required: true, unique: true, trim: true },
    valeur: { type: String, required: true, trim: true },
  },
  { timestamps: true, versionKey: false }
);

const Parametre = mongoose.model("Parametre", ParametreSchema);

// Helper pratique : récupère l'année scolaire active, avec une valeur de secours
// si jamais elle n'a pas encore été configurée en base.
async function getAnneeActive() {
  const param = await Parametre.findOne({ cle: "anneeScolaireActive" });
  return param ? param.valeur : "2025-2026";
}

async function setAnneeActive(valeur) {
  const param = await Parametre.findOneAndUpdate(
    { cle: "anneeScolaireActive" },
    { valeur },
    { new: true, upsert: true }
  );
  return param.valeur;
}

module.exports = { Parametre, getAnneeActive, setAnneeActive };
