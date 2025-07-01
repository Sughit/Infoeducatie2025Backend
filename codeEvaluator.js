const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const TMP_DIR = './tmp';
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

app.post('/evaluate', async (req, res) => {
  const { code, testCases } = req.body;

  if (!code || !Array.isArray(testCases)) {
    return res.status(400).json({ error: 'Codul sau testele lipsesc' });
  }

  const fileId = uuidv4();
  const filePath = `${TMP_DIR}/${fileId}.cpp`;
  const exePath = `${TMP_DIR}/${fileId}.out`;

  try {
    fs.writeFileSync(filePath, code);

    exec(`g++ "${filePath}" -o "${exePath}"`, (compileErr, _, compileStderr) => {
      if (compileErr) {
        cleanup();
        console.error('Eroare la compilare:', compileStderr);
        return res.status(400).json({ error: 'Eroare la compilare', details: compileStderr });
      }

      let passed = 0;
      const results = [];

      const runTest = (i) => {
        if (i >= testCases.length) {
          cleanup();
          return res.json({
            total: testCases.length,
            passed,
            score: `${passed} / ${testCases.length}`,
            results
          });
        }

        const { input, output: expected } = testCases[i];

        exec(`"${exePath}"`, { input, timeout: 3000 }, (err, stdout, stderr) => {
          const actual = (stdout || stderr || '').trim();
          const expectedClean = expected.trim();
          const ok = actual === expectedClean;

          if (ok) passed++;
          results.push({ input, expected: expectedClean, output: actual, passed: ok });

          runTest(i + 1);
        });
      };

      runTest(0);
    });
  } catch (err) {
    cleanup();
    console.error('Eroare internă:', err);
    return res.status(500).json({ error: 'Eroare internă la server' });
  }

  // 🧽 Funcție de curățare
  function cleanup() {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Evaluatorul rulează pe http://localhost:${PORT}`);
});
