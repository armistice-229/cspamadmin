require('dotenv').config();
const express = require('express');
const cors = require('cors');
//const morgan = require('morgan');
const connectDB = require('./config/db');

const app = express();

// Connexion à la base de données
connectDB();

// Domaine de ton frontend (exemple : https://mon-frontend.com)
const FRONTEND_URL = "https://cspam.onrender.com";

app.use(cors({
  origin: FRONTEND_URL,    // ✅ seul ce domaine est accepté
  methods: ["GET", "POST", "PUT", "DELETE"], // méthodes autorisées
  credentials: true        // si tu utilises cookies/token
}));

app.use(express.json());
//app.use(morgan('dev'));

// Routes API
const AdminRoutes = require('./routes/admin');
app.use('/api/admin', AdminRoutes);

const CaisseRoutes = require('./routes/caisse');
app.use('/api/caisse', CaisseRoutes);

const UserRoutes = require('./routes/auth');
app.use('/api/users', UserRoutes);

const certificatRoutes = require('./routes/certificat');
app.use('/api/certificat', certificatRoutes);

const eleveRoutes = require('./routes/eleve');
app.use('/api/eleves', eleveRoutes);

const dashboardRoutes = require("./routes/dashboard");
app.use("/api/dashboard", dashboardRoutes);

const rapportRoutes = require("./routes/rapport");
app.use("/api/rapport", rapportRoutes);


// Démarrage du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur en écoute sur le port ${PORT}`);
});
