const mongoose = require("mongoose");

const FraisScolariteSchema = new mongoose.Schema(
  {
    classe: {
      type: String,
      enum: ["Maternelle", "CI", "CP", "CE1", "CE2", "CM1", "CM2"],
      required: true,
    },
    montant: {
      type: Number,
      required: true,
      min: 0,
    },
    anneeScolaire: {
      type: String, // ex: "2024-2025"
      required: true,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("FraisScolarite", FraisScolariteSchema);
