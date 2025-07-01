const express = require('express');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const corsOptions = {
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 

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
        const proc = spawn(exePath);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on('close', () => {
          const actual = (stdout || stderr).trim();
          const expectedClean = expected.trim();
          const ok = actual === expectedClean;

          if (ok) passed++;
          results.push({ input, expected: expectedClean, output: actual, passed: ok });

          runTest(i + 1);
        });

        // Trimite input-ul către stdin
        proc.stdin.write(input);
        proc.stdin.end();
      };

      runTest(0);
    });
  } catch (err) {
    cleanup();
    console.error('Eroare internă:', err);
    return res.status(500).json({ error: 'Eroare internă la server' });
  }

  function cleanup() {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.warn('⚠️ Nu s-a putut șterge fișierul .cpp:', err.message);
    }

    setTimeout(() => {
      try {
        if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
      } catch (err) {
        console.warn('⚠️ Nu s-a putut șterge fișierul .out:', err.message);
      }
    }, 100);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Evaluatorul rulează pe http://localhost:${PORT}`);
});
