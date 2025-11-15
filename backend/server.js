const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Minio = require('minio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
});

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
  const codeMatch = text.match(/```cpp\s*(.*?)\s*```/s);
  if (codeMatch) {
    return codeMatch[1].trim();
  }
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

    const fileName = `generated_${Date.now()}.cpp`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, code);

    const metaData = {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    };
    minioClient.fPutObject(bucketName, fileName, filePath, metaData, async (err, etag) => {
      if (err) {
        console.error('Error uploading to MinIO:', err);
        return res.status(500).json({ error: 'Failed to upload file' });
      }

      fs.unlinkSync(filePath);

      try {
        const presignedUrl = await minioClient.presignedGetObject(bucketName, fileName, 24 * 60 * 60);
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