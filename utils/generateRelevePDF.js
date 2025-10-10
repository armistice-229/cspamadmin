// utils/generateRelevePDF.js
const PDFDocument = require("pdfkit");
const path = require("path");

async function generateRelevePDF(res, eleve, transactions, tarif) {
    const totalScolarite = tarif ? tarif.montant : 0;
    const totalPaye = transactions.reduce((sum, t) => sum + t.montant, 0);
    const reste = totalScolarite - totalPaye;

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    res.setHeader(
        "Content-Disposition",
        `inline; filename="releve_${eleve.nom}_${eleve.prenom}.pdf"`
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    // === HEADER ===
    const logoPath = path.join(__dirname, "assets/logo.png");
    try {
        doc.image(logoPath, 40, 30, { width: 60 });
        doc.image(logoPath, 500, 30, { width: 60 });
    } catch (e) {
        console.warn("Logo manquant :", e.message);
    }

    doc
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Complexe Scolaire Privé Arche du Millénium (CSPAM) de Comé", 40, 40, {
            align: "center",
        })
        .moveDown(0.3)
        .fontSize(10)
        .font("Helvetica")
        .text("Travail – Discipline – Succès", { align: "center" })
        .moveDown(0.3)
        .font("Helvetica-Bold")
        .text(`Année Scolaire : 2025-2026`, { align: "center" });

    doc.moveDown(2);

    // --- TITRE ---
    doc
        .fontSize(14)
        .fillColor("black")
        .font("Helvetica-Bold")
        .text("RELEVE DE COMPTE SCOLARITE", { align: "center", underline: true })
        .moveDown(1.5);

    // --- INFOS ÉLÈVE ---
    doc.fontSize(11).font("Helvetica");
    doc.text(
        `Nom de l'élève : ${eleve.nom.toUpperCase()} ${eleve.prenom}, ${eleve.classe}`,
        { align: "left", underline: false }
    );
    doc.moveDown(1.2);

// --- DÉTAIL DES PAIEMENTS ---
doc
  .font("Helvetica-Bold")
  .fontSize(11)
  .text("Détail des paiements", { underline: true })
  .moveDown(0.5);

const tableTop = doc.y + 10;
const tableLeft = 40;
const tableWidth = 520;
const rowHeight = 25; // hauteur min
const colWidths = [40, 110, 80, 210, 80];
const headers = ["N°", "Références", "Date", "Description", "Montant versé"];

// === En-tête ===
let x = tableLeft;
doc.rect(tableLeft, tableTop, tableWidth, rowHeight).fillAndStroke("#f0f0f0", "black");
doc.font("Helvetica-Bold").fontSize(10).fillColor("black");
headers.forEach((h, i) => {
  doc.text(h, x + 5, tableTop + 7, { width: colWidths[i] - 10, align: "left" });
  x += colWidths[i];
});

// Traits verticaux en-tête
x = tableLeft;
colWidths.forEach((w) => {
  doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();
  x += w;
});
doc.moveTo(tableLeft + tableWidth, tableTop).lineTo(tableLeft + tableWidth, tableTop + rowHeight).stroke();

// === Lignes de paiement ===
let y = tableTop + rowHeight;
doc.font("Helvetica").fontSize(10).fillColor("black");

transactions.forEach((t, index) => {
  let x = tableLeft;

  // 🔑 Calcul de la hauteur max nécessaire dans cette ligne
  const cellHeights = [];

  cellHeights.push(doc.heightOfString(String(index + 1), { width: colWidths[0] - 10 }));
  cellHeights.push(doc.heightOfString(t.reference || "", { width: colWidths[1] - 10 }));
  cellHeights.push(doc.heightOfString(new Date(t.date).toLocaleDateString("fr-FR"), { width: colWidths[2] - 10 }));
  cellHeights.push(doc.heightOfString(t.motifs || "", { width: colWidths[3] - 10 }));
  cellHeights.push(doc.heightOfString(`${Number(t.montant).toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`, { width: colWidths[4] - 10 }));

  const currentRowHeight = Math.max(rowHeight, ...cellHeights) + 10; // ajoute marge

  // rectangle ligne
  doc.rect(tableLeft, y, tableWidth, currentRowHeight).stroke();

  // contenu de chaque colonne
  doc.text(index + 1, x + 5, y + 7, { width: colWidths[0] - 10 }); x += colWidths[0];
  doc.text(t.reference, x + 5, y + 7, { width: colWidths[1] - 10 }); x += colWidths[1];
  doc.text(new Date(t.date).toLocaleDateString("fr-FR"), x + 5, y + 7, { width: colWidths[2] - 10 }); x += colWidths[2];
  doc.text(t.motifs, x + 5, y + 7, { width: colWidths[3] - 10 }); x += colWidths[3];
  doc.text(`${Number(t.montant).toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`, x - 5, y + 7, {
    width: colWidths[4],
    align: "right"
  });

  // traits verticaux
  let xx = tableLeft;
  colWidths.forEach((w) => {
    doc.moveTo(xx, y).lineTo(xx, y + currentRowHeight).stroke();
    xx += w;
  });
  doc.moveTo(tableLeft + tableWidth, y).lineTo(tableLeft + tableWidth, y + currentRowHeight).stroke();

  y += currentRowHeight;
});

// === Ligne Total ===
const totalRowHeight = rowHeight;
doc.rect(tableLeft, y, tableWidth, totalRowHeight).fillAndStroke("#f0f0f0", "black");
doc.font("Helvetica-Bold").fillColor("black");
doc.text("Total", tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 5, y + 7, { width: colWidths[3] - 10 });
doc.text(`${Number(totalPaye).toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 5, y + 7, {
  width: colWidths[4],
  align: "right"
});

// traits verticaux pour ligne total
let xx = tableLeft;
colWidths.forEach((w) => {
  doc.moveTo(xx, y).lineTo(xx, y + totalRowHeight).stroke();
  xx += w;
});
doc.moveTo(tableLeft + tableWidth, y).lineTo(tableLeft + tableWidth, y + totalRowHeight).stroke();

// avance la position Y de 2 lignes sous le tableau
y += rowHeight + 20;
doc.moveDown();
doc.y = y;

// réinitialise le flux texte avec la marge normale
doc.x = 40; // marge gauche standard PDFKit

    // --- SITUATION DU COMPTE ---
    doc.font("Helvetica-Bold").fontSize(11).text("Situation du compte", { underline: true });
    doc.moveDown(0.5);

    const boxX = 40;
    let boxY = doc.y;
    const boxW = 400;
    const lineH = 25;

    // Ligne 1
    doc.rect(boxX, boxY, boxW, lineH).stroke();
    doc.font("Helvetica-Bold").fillColor("black").text("Montant total de scolarité(+ Frais obligatoires)", boxX + 10, boxY + 7);
    doc.text(`${totalScolarite.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`, boxX + 200, boxY + 7, { width: 190, align: "right" });
    boxY += lineH;

    // Ligne 2 (fond gris)
    doc.rect(boxX, boxY, boxW, lineH).fillAndStroke("#e0e0e0", "black");
    doc.font("Helvetica-Bold").fillColor("black").text("Total déjà payé", boxX + 10, boxY + 7);
    doc.fillColor("green").text(`${totalPaye.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`, boxX + 200, boxY + 7, { width: 190, align: "right" });
    boxY += lineH;

    // Ligne 3
    doc.rect(boxX, boxY, boxW, lineH).stroke();
    doc.font("Helvetica-Bold").fillColor("black").text("Reste à payer", boxX + 10, boxY + 7);
    doc.fillColor("red").text(`${reste.toLocaleString("fr-FR").replace(/\u202F/g, " ")} FCFA`, boxX + 200, boxY + 7, { width: 190, align: "right" });

    // avance la position Y de 2 lignes sous le tableau


// réinitialise le flux texte avec la marge normale
doc.x = 40; // marge gauche standard PDFKit

    // --- NOTE IMPORTANTE ---
doc.moveDown(2);

// Définir dimensions du bloc
const boxeX = 40;      // marge gauche
const boxWidth = 520; // largeur du bloc
let boxeY = doc.y;
const boxPadding = 10;

// On calcule la hauteur du bloc en simulant le texte
let noteText =
  "Le dernier délai de paiements de la 1ère Tranche des frais de scolarité est fixé au 20 Octobre 2025. Nous prions les parents concernés de bien vouloir passer au secrétariat pour régulariser la situation de leur enfant avant cette date.\n\nPassé ce délai, des mesures seront prises conformément au règlement intérieur de l’école.";

// Sauvegarde l’état pour mesurer
doc.font("Helvetica").fontSize(9);
let textHeight = doc.heightOfString(noteText, { width: boxWidth - 2 * boxPadding });

// Dessin du fond gris clair
doc.rect(boxeX, boxeY, boxWidth, textHeight + 45) // +45 pour inclure titre et marges
   .fill("#f5f5f5")
   .stroke();

// Titre
doc.fillColor("black")
   .font("Helvetica-Bold")
   .fontSize(11)
   .text("Note Importante", boxeX + boxPadding, boxeY + boxPadding, { underline: true });

// Texte principal
doc.moveDown(0.7)
   .font("Helvetica")
   .fontSize(10)
   .fillColor("black")
   .text("Le dernier délai de paiements de la ", boxeX + boxPadding, doc.y, {
     continued: true,
     width: boxWidth - 2 * boxPadding,
     align: "justify"
   })
   .font("Helvetica-Bold").text("1ère Tranche", { continued: true })
   .font("Helvetica").text(" des frais de scolarité est fixé au ", { continued: true })
   .font("Helvetica-Bold").text("20 Octobre 2025", { continued: true })
   .font("Helvetica").text(". Nous prions les parents concernés de bien vouloir passer au secrétariat pour régulariser la situation de leur enfant avant cette date.\n\n", {
     width: boxWidth - 2 * boxPadding,
     align: "justify"
   })
   .text("Passé ce délai, des mesures seront prises conformément au règlement intérieur de l’école.", {
     width: boxWidth - 2 * boxPadding,
     align: "justify"
   });

    // --- SIGNATURE ---
    doc.moveDown(2);
    doc.fontSize(10).text("La Direction", { align: "right" });

    const QRCode = require("qrcode");

// --- SIGNATURE + QR CODE & TAMPON ---
doc.moveDown(3); // espace après "La Direction"

// Position Y dynamique après le texte
let posY = doc.y;

// Génération QR code auto
try {
  const qrData = await QRCode.toDataURL(
    `Relevé de compte - ${eleve.nom} ${eleve.prenom} - ${new Date().toLocaleDateString("fr-FR")}`
  );

  const qrBase64 = qrData.replace(/^data:image\/png;base64,/, "");
  const qrBuffer = Buffer.from(qrBase64, "base64");

  // QR Code à gauche
  doc.image(qrBuffer, 60, posY, { width: 80 });

  // Tampon à droite
  const stampPath = path.join(__dirname, "assets/stamp.png");
  doc.image(stampPath, 380, posY - 10, { width: 120 });

} catch (e) {
  console.warn("Erreur génération QR ou tampon :", e.message);
}
// --- Pied de page automatique ---
const now = new Date();
const dateStr = now.toLocaleDateString("fr-FR");
const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

doc.fontSize(9)
   .fillColor("gray")
   .text(`Généré sur AcademyFlow le ${dateStr} à ${timeStr}`, 
         50, doc.page.height - 80, {
             align: "center",
             width: doc.page.width - 100
         });
doc.end();

}

module.exports = generateRelevePDF;
