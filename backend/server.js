const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Minio = require('minio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

// Ensure bucket exists
const bucketName = process.env.MINIO_BUCKET;
minioClient.makeBucket(bucketName, '', (err) => {
  if (err && err.code !== 'BucketAlreadyExists' && err.code !== 'BucketAlreadyOwnedByYou') {
    console.error('Error creating bucket:', err);
  } else {
    console.log('Bucket ready');
  }
});

async function generateCppCode(query) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `Generate C++ code for the following request: ${query}. Provide only the code in a code block.`;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  // Extract code from markdown
  const codeMatch = text.match(/```cpp\s*(.*?)\s*```/s);
  if (codeMatch) {
    return codeMatch[1].trim();
  }
  // If no cpp block, try general code block
  const generalMatch = text.match(/```\s*(.*?)\s*```/s);
  return generalMatch ? generalMatch[1].trim() : text.trim();
}

// Endpoint to generate code
app.post('/generate-code', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const code = await generateCppCode(query);

    // Write to temp file
    const fileName = `generated_${Date.now()}.cpp`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, code);

    // Upload to MinIO
    const metaData = {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    };
    minioClient.fPutObject(bucketName, fileName, filePath, metaData, async (err, etag) => {
      if (err) {
        console.error('Error uploading to MinIO:', err);
        return res.status(500).json({ error: 'Failed to upload file' });
      }

      // Delete temp file
      fs.unlinkSync(filePath);

      // Generate presigned URL for download
      try {
        const presignedUrl = await minioClient.presignedGetObject(bucketName, fileName, 24 * 60 * 60); // 24 hours
        res.json({ fileUrl: presignedUrl, code });
      } catch (presignErr) {
        console.error('Error generating presigned URL:', presignErr);
        res.status(500).json({ error: 'Failed to generate download link' });
      }
    });

  } catch (error) {
    console.error('Error generating code:', error);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});