const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const { Configuration, OpenAIApi } = require("openai");
const textToSpeech = require("@google-cloud/text-to-speech");

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const client = new textToSpeech.TextToSpeechClient();

app.post("/voice", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No audio uploaded");

    const transcription = await openai.createTranscription(
      fs.createReadStream(req.file.path),
      "whisper-1"
    );

    const userText = transcription.data.text;

    const chatResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userText }
      ],
    });

    const gptText = chatResponse.data.choices[0].message.content;

    const [ttsResponse] = await client.synthesizeSpeech({
      input: { text: gptText },
      voice: { languageCode: "en-US", ssmlGender: "FEMALE" },
      audioConfig: { audioEncoding: "MP3" }
    });

    res.set("Content-Type", "audio/mpeg");
    res.send(ttsResponse.audioContent);
  } catch (e) {
    console.error(e);
    res.status(500).send("Something went wrong");
  } finally {
    if (req.file) fs.unlinkSync(req.file.path);
  }
});

app.get("/", (req, res) => {
  res.send("Voice GPT Backend is running!");
});

app.listen(port, () => console.log("Server running on port", port));
