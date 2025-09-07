const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, );
    console.log('✅ Connexion MongoDB réussie');
  } catch (error) {
    console.error('❌ Connexion MongoDB échouée', error.message);
    process.exit(1); // Arrête le serveur si la DB ne se connecte pas
  }
};

module.exports = connectDB;
