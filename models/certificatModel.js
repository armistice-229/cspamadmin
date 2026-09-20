const mongoose = require("mongoose");

const CertificatSchema = new mongoose.Schema(
  {
    numeroCertificat: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // 🔗 Référence vers l'élève concerné
    eleve: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Eleve",
      required: false
    },
    //garder la trace du certificat
    nomEleve: { type: String, required: true, trim: true },
    classe: { type: String, required: true, trim: true },
    matricule: { type: String, trim: true },

    // Dates importantes
    dateFirstInscription: { type: Date, trim: true }, // format JJ/MM/AAAA
    dateDelivrance: { type: String, required: true, trim: true }, // date de création du certificat
  },
  { timestamps: true, versionKey: false }
);

// Index utile pour les recherches rapides
CertificatSchema.index({ numeroCertificat: 1, matricule: 1 });

const Certificat = mongoose.model("Certificat", CertificatSchema);
module.exports = Certificat;
