const express = require("express");
const dotenv = require("dotenv");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buffer } = require("stream/consumers");

dotenv.config();
const app = express();
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" }); // Disarankan menggunakan 1.5-flash atau 1.5-pro untuk multimodal, karena 2.0-flash mungkin belum sepenuhnya mendukung. Coba ini dulu.

const upload = multer({ dest: "uploads/" }); // Pastikan folder 'uploads' ada di root project Anda
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Gemini API server is running at http://localhost:${PORT}`);
});

// Helper function untuk mengubah file lokal menjadi bagian generatif untuk Gemini API
// Ini adalah definisi yang Anda lewatkan!
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType,
    },
  };
}

app.post("/generate-text", async (req, res) => {
  const { prompt } = req.body;

  try {
    const result = await model.generateContent(prompt);
    console.log("Gemini Text API Result Object:", result);

    const response = result.response;
    const outputText = await response.text();

    res.json({ output: outputText });
  } catch (error) {
    console.error("Error generating text content:", error);
    res.status(500).json({ error: error.message });
  }
});

const imageToGenerativePart = (filePath) => ({
  inlineData: {
    data: fs.readFileSync(filePath).toString("base64"),
    mimeType: "image/png", // Pastikan ini sesuai dengan tipe file yang Anda unggah
  },
});

app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  const prompt = req.body.prompt;
  // Hapus baris di bawah ini jika tidak digunakan:
  // ("describe the image"); // Ambil prompt dari body request
  const image = imageToGenerativePart(req.file.path); // Dapatkan path file yang diunggah oleh multer

  try {
    // Kirim prompt dan gambar ke Gemini API
    const result = await model.generateContent([prompt, image]); // Perubahan di sini: imagePart menjadi image
    const response = await result.response;
    const outputText = response.text(); // Anda perlu mendapatkan teks dari respons
    res.json({ output: outputText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (req.file && req.file.path) {
      // Pastikan file ada sebelum dihapus
      fs.unlinkSync(req.file.path); // Hapus file setelah selesai
    }
  }
});

app.post(
  "/generate-from-document",
  upload.single("document"),
  async (req, res) => {
    // Perbaikan typo 'connts' menjadi 'const'
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString("base64");
    const mimeType = req.file.mimetype; // Dapatkan tipe MIME dari file yang diunggah

    // Ambil prompt dari body request, atau gunakan prompt default
    const prompt =
      req.body.prompt ||
      "Please analyze this document and summarize its main points.";

    try {
      const documentPart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      };

      const result = await model.generateContent([prompt, documentPart]);
      const response = await result.response;
      res.json({ output: response.text() });
    } catch (error) {
      console.error("Error processing document:", error); // Log error untuk debugging
      res.status(500).json({ error: error.message });
    } finally {
      // Tambahkan pengecekan sebelum menghapus file
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path); // Hapus file setelah selesai
      }
    }
  }
);

app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
  const filePath = req.file.path;
  const buffer = fs.readFileSync(filePath);
  const base64Data = buffer.toString("base64");
  const mimeType = req.file.mimetype;

  const prompt = "Transcribe or analyze the following audio:";

  try {
    const audioPart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([prompt, audioPart]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (error) {
    console.error("Error processing audio:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
  }
});
