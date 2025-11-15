const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Minio = require('minio');
const fs = require('fs');
const path = require('path');
const natural = require('natural');
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

function calculateBleuScore(reference, candidate, maxN = 4) {
  const tokenizer = new natural.WordTokenizer();
  const refTokens = tokenizer.tokenize(reference.toLowerCase());
  const candTokens = tokenizer.tokenize(candidate.toLowerCase());

  if (candTokens.length === 0) return 0;

  let bleuSum = 0;
  let validGrams = 0;

  for (let n = 1; n <= maxN; n++) {
    const refNGrams = natural.NGrams.ngrams(refTokens, n);
    const candNGrams = natural.NGrams.ngrams(candTokens, n);

    if (candNGrams.length === 0) continue;

    const refNGramCounts = {};
    refNGrams.forEach(gram => {
      const key = gram.join(' ');
      refNGramCounts[key] = (refNGramCounts[key] || 0) + 1;
    });

    let matches = 0;
    candNGrams.forEach(gram => {
      const key = gram.join(' ');
      if (refNGramCounts[key] > 0) {
        matches++;
        refNGramCounts[key]--;
      }
    });

    const precision = matches / candNGrams.length;
    bleuSum += precision;
    validGrams++;
  }

  const avgPrecision = validGrams > 0 ? bleuSum / validGrams : 0;
  
  const brevityPenalty = candTokens.length < refTokens.length 
    ? Math.exp(1 - refTokens.length / candTokens.length) 
    : 1;

  return avgPrecision * brevityPenalty;
}

async function generateCppCode(query) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `Generate C++ code for the following request: ${query}. Provide only the code in a code block.`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const codeMatch = text.match(/```cpp\s*(.*?)\s*```/s);
  if (codeMatch) return codeMatch[1].trim();

  const genericMatch = text.match(/```\s*(.*?)\s*```/s);
  return genericMatch ? genericMatch[1].trim() : text.trim();
}

app.post('/generate-code', async (req, res) => {
  try {
    const { query, reference } = req.body;

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
        const presignedUrl = await minioClient.presignedGetObject(bucketName, fileName, 86400);

        let bleuScore = null;
        if (reference) {
          bleuScore = calculateBleuScore(reference, code);
        }

        res.json({ fileUrl: presignedUrl, code, bleuScore });

      } catch (presignErr) {
        console.error('Error generating presigned URL:', presignErr);
        res.status(500).json({ error: 'Failed to generate download link' });
      }
    });

  } catch (err) {
    console.error('Error generating code:', err);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));