const mongoose = require("mongoose");

const agentCaisseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // école à laquelle appartient cet agent
      required: true,
    },
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    prenom: {
      type: String,
      required: true,
      trim: true,
    },
    fonction: {
      type: String, // ex: "titulaire", "adjoint"
      default: "titulaire",
    },
    actif: {
      type: Boolean,
      default: true, // si un agent n’est plus en fonction
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("AgentCaisse", agentCaisseSchema);
